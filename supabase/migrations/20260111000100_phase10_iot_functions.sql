-- ─────────────────────────────────────────────────────────────────────────────
-- SRP Phase 10: IoT + Access Control functions
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── record_device_event ──────────────────────────────────────────────────

create or replace function public.record_device_event(
  p_device_id       uuid,
  p_event_kind      public.device_event_kind,
  p_payload         jsonb default '{}'::jsonb,
  p_measurement_value numeric default null,
  p_measurement_unit  text default null,
  p_source          text default 'webhook'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    bigint;
  v_org   uuid;
  v_status public.device_status;
begin
  select organization_id, status into v_org, v_status from public.devices where id = p_device_id;
  if v_org is null then raise exception 'record_device_event: device not found'; end if;

  insert into public.device_events (
    organization_id, device_id, event_kind, payload,
    measurement_value, measurement_unit, source
  )
  values (v_org, p_device_id, p_event_kind, p_payload, p_measurement_value, p_measurement_unit, p_source)
  returning id into v_id;

  if p_event_kind in ('heartbeat','online','measurement') then
    update public.devices
      set last_seen_at = now(),
          status = case when status in ('provisioned','offline','degraded','unknown') then 'online'::public.device_status else status end
      where id = p_device_id;
  elsif p_event_kind = 'offline' then
    update public.devices set status = 'offline' where id = p_device_id;
  elsif p_event_kind = 'alarm' then
    perform public.raise_system_alert(
      v_org, 'device_alarm', 'warning'::public.alert_severity,
      'Device alarm', coalesce(p_payload ->> 'message', 'Device raised an alarm'),
      'devices', p_device_id,
      jsonb_build_object('value', p_measurement_value, 'unit', p_measurement_unit, 'source', p_source),
      (select compound_id from public.devices where id = p_device_id)
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_device_event(uuid, public.device_event_kind, jsonb, numeric, text, text) from public;
grant execute on function public.record_device_event(uuid, public.device_event_kind, jsonb, numeric, text, text) to authenticated;

-- ─── evaluate_access ──────────────────────────────────────────────────────
-- Decides grant/deny + writes the access_logs row. Used by gate-controller
-- webhooks and the QR-scan endpoint. No `goto` — pure conditional logic.

create or replace function public.evaluate_access(
  p_zone_id      uuid,
  p_method       public.access_method,
  p_identifier   text,
  p_vehicle_plate text default null,
  p_direction    text default 'in',
  p_device_id    uuid default null
)
returns public.access_outcome
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone        public.access_zones%rowtype;
  v_visitor     public.visitors%rowtype;
  v_resident_id uuid;
  v_visitor_id  uuid;
  v_outcome     public.access_outcome := 'denied';
begin
  select * into v_zone from public.access_zones where id = p_zone_id;

  -- Only run the lookup logic if the zone exists and is active.
  if found and v_zone.is_active then
    if p_method = 'qr' then
      select * into v_visitor from public.visitors
      where pass_code = p_identifier and organization_id = v_zone.organization_id
      limit 1;
      if found then
        v_visitor_id := v_visitor.id;
        if v_visitor.status in ('approved','checked_in') and v_visitor.scheduled_date = current_date then
          v_outcome := 'granted';
          if v_visitor.status = 'approved' then
            update public.visitors set status = 'checked_in', checked_in_at = now()
              where id = v_visitor.id;
          end if;
        elsif v_visitor.status = 'rejected' then
          v_outcome := 'denied';
        elsif v_visitor.scheduled_date < current_date then
          v_outcome := 'expired';
        else
          v_outcome := 'denied';
        end if;
      end if;

    elsif p_method = 'plate' and p_vehicle_plate is not null then
      select pa.resident_id into v_resident_id
      from public.parking_assignments pa
      where pa.compound_id = v_zone.compound_id
        and pa.status = 'active'
        and upper(replace(coalesce(pa.vehicle_plate, ''), ' ', '')) = upper(replace(coalesce(p_vehicle_plate, ''), ' ', ''))
      limit 1;
      if v_resident_id is not null then
        v_outcome := 'granted';
      end if;

    elsif p_method in ('rfid','pin','app','biometric') then
      if p_identifier ~ '^[0-9a-f-]{36}$' then
        select id into v_resident_id from public.residents
        where id::text = p_identifier and organization_id = v_zone.organization_id
          and resident_status = 'active';
        if v_resident_id is not null then v_outcome := 'granted'; end if;
      end if;

    elsif p_method = 'manual' then
      v_outcome := 'manual_override';
    end if;
  end if;

  -- Always log the attempt, even when zone is missing/inactive.
  insert into public.access_logs (
    organization_id, compound_id, zone_id, device_id, resident_id, visitor_id,
    method, outcome, direction, identifier, vehicle_plate
  )
  values (
    coalesce(v_zone.organization_id, (select organization_id from public.access_zones where id = p_zone_id)),
    coalesce(v_zone.compound_id,     (select compound_id     from public.access_zones where id = p_zone_id)),
    p_zone_id, p_device_id,
    v_resident_id, v_visitor_id,
    p_method, v_outcome, p_direction, p_identifier, p_vehicle_plate
  );

  return v_outcome;
end;
$$;

revoke all on function public.evaluate_access(uuid, public.access_method, text, text, text, uuid) from public;
grant execute on function public.evaluate_access(uuid, public.access_method, text, text, text, uuid) to authenticated;

-- ─── issue_device_command ─────────────────────────────────────────────────

create or replace function public.issue_device_command(
  p_device_id    uuid,
  p_command      text,
  p_payload      jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_org uuid;
begin
  select organization_id into v_org from public.devices where id = p_device_id;
  if v_org is null then raise exception 'issue_device_command: device not found'; end if;

  insert into public.device_commands (organization_id, device_id, command, payload, scheduled_for, issued_by)
  values (v_org, p_device_id, p_command, p_payload, p_scheduled_for, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.issue_device_command(uuid, text, jsonb, timestamptz) from public;
grant execute on function public.issue_device_command(uuid, text, jsonb, timestamptz) to authenticated;

-- ─── complete_device_command ──────────────────────────────────────────────

create or replace function public.complete_device_command(
  p_id      uuid,
  p_status  public.command_status,
  p_result  jsonb default null,
  p_error   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.device_commands
    set status         = p_status,
        result         = p_result,
        error_message  = p_error,
        attempts       = attempts + 1,
        acknowledged_at = coalesce(acknowledged_at, case when p_status in ('sent','acknowledged') then now() else null end),
        completed_at   = case when p_status in ('succeeded','failed','timeout','cancelled') then now() else completed_at end
    where id = p_id;
end;
$$;

revoke all on function public.complete_device_command(uuid, public.command_status, jsonb, text) from public;
grant execute on function public.complete_device_command(uuid, public.command_status, jsonb, text) to authenticated;
