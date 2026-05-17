"use client";

/**
 * Branding image picker — used by the branding form for logo, dark logo,
 * favicon, and the login-page hero image. Wraps a hidden <input type="file">
 * with a preview tile, a remove button, and an "Upload new" button.
 *
 * On upload it posts the file to the `uploadBrandingImage` server action,
 * which writes it to the `branding` Supabase Storage bucket and returns a
 * public URL. The URL is stored back into the parent form via the `onChange`
 * prop AND into a hidden text input so plain-form submission still works.
 */
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadBrandingImage } from "@/lib/api/saas";

interface BrandingImageUploadProps {
  /** Hidden input name — the form reads this on submit. */
  name:    "logo_path" | "logo_dark_path" | "favicon_path" | "login_hero_path";
  /** Server-side kind passed to uploadBrandingImage. */
  kind:    "logo" | "logo_dark" | "favicon" | "login_hero";
  orgId:   string;
  /** Current value (URL) from DB. */
  defaultUrl?: string | null;
  /** Optional aspect-ratio hint for the preview. Defaults to square. */
  aspect?: "square" | "wide";
  /** Help text shown under the picker. */
  hint?:   string;
}

export function BrandingImageUpload({
  name, kind, orgId, defaultUrl, aspect = "square", hint,
}: BrandingImageUploadProps) {
  const [url,      setUrl]      = useState<string>(defaultUrl ?? "");
  const [pending,  startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("orgId", orgId);
        fd.append("kind",  kind);
        fd.append("file",  file);
        const { url: newUrl } = await uploadBrandingImage(fd);
        setUrl(newUrl);
        toast.success("Image uploaded");
      } catch (err) {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "",
        });
      } finally {
        // Reset the input so the same file can be re-selected if needed.
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function clear() {
    setUrl("");
  }

  const previewClasses =
    aspect === "wide"
      ? "h-24 w-full"  // 16:6-ish for hero images
      : "h-20 w-20";   // square for logos/favicon

  return (
    <div className="space-y-2">
      {/* Hidden text input so the parent form posts the URL on submit. */}
      <input type="hidden" name={name} value={url} readOnly />

      <div className="flex items-center gap-3">
        <div
          className={`${previewClasses} relative shrink-0 overflow-hidden rounded-md border bg-muted/40 grid place-items-center`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image
              src={url}
              alt="preview"
              fill
              sizes="80px"
              className="object-contain"
              unoptimized
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pick}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {url ? "Replace" : "Upload"}
            </Button>
            {url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clear}
                disabled={pending}
              >
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
