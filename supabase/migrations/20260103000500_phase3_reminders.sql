-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 3: Reminder generator
-- ─────────────────────────────────────────────────────────────────────────────
-- Generates reminders for installments based on their relationship to today:
--   - upcoming  : due within p_upcoming_days (default 7) and not paid
--   - overdue   : due_date < today, status != paid
-- Idempotent per (installment, kind) per day.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.generate_payment_reminders(p_upcoming_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst       record;
  v_kind       public.reminder_kind;
  v_total      int := 0;
begin
  for v_inst in
    select s.id, s.contract_id, s.due_date, s.status,
           c.organization_id, c.compound_id, c.resident_id
    from public.installment_schedules s
    join public.installment_contracts c on c.id = s.contract_id
    where s.status in ('pending','partial','overdue')
      and (s.total_due + s.penalty_amount - s.paid_amount) > 0
      and c.contract_status = 'active'
  loop
    -- Decide reminder kind
    if v_inst.due_date < current_date then
      v_kind := 'overdue';
    elsif v_inst.due_date <= current_date + p_upcoming_days then
      v_kind := 'upcoming';
    else
      continue;
    end if;

    -- Skip if a reminder of this kind already exists for this installment today
    if exists (
      select 1 from public.payment_reminders
      where installment_id = v_inst.id
        and kind = v_kind
        and scheduled_for::date = current_date
    ) then
      continue;
    end if;

    insert into public.payment_reminders (
      organization_id, compound_id, contract_id, installment_id, resident_id,
      kind, channel, status, scheduled_for, payload
    ) values (
      v_inst.organization_id, v_inst.compound_id, v_inst.contract_id, v_inst.id, v_inst.resident_id,
      v_kind, 'in_app', 'pending', now(),
      jsonb_build_object('due_date', v_inst.due_date, 'auto_generated', true)
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.generate_payment_reminders(int) from public;
grant execute on function public.generate_payment_reminders(int) to authenticated;

-- Mark a reminder as dismissed.
create or replace function public.dismiss_reminder(p_reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_reminders
  set status = 'dismissed', updated_at = now()
  where id = p_reminder_id;
end;
$$;

revoke all on function public.dismiss_reminder(uuid) from public;
grant execute on function public.dismiss_reminder(uuid) to authenticated;
