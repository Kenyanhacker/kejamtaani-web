"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LISTING_STATUSES, LandlordListing, listingDraftKey } from "@/lib/landlord-listings";
import { TYPES } from "@/lib/data";
import InteractiveMap from "@/components/InteractiveMap";

const AMENITIES = ["Wi-Fi", "Borehole", "Token Meter", "Parking", "Security/CCTV", "Balcony"];
const MAX_PHOTOS = 5;
const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_WEBP_DATA_URL_LENGTH = Math.ceil(2 * 1024 * 1024 * 4 / 3) + 64;

type FormValues = Omit<LandlordListing, "id" | "createdAt">;

const EMPTY_FORM: FormValues = {
  title: "",
  buildingName: "",
  unitType: TYPES[1],
  estate: "",
  county: "Nairobi",
  address: "",
  latitude: "",
  longitude: "",
  amenities: [],
  status: "Available",
  availabilityDate: "",
  rent: 0,
  depositRule: "1 month rent + 1 month deposit",
  description: "",
  tourUrl: "",
  photos: [],
};

const STEPS = ["Basic info", "Location", "Amenities", "Pricing", "Media"];
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function restoreDraft(value: unknown): FormValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved draft is in an invalid format.");
  const draft = value as Partial<FormValues>;
  return {
    title: typeof draft.title === "string" ? draft.title : EMPTY_FORM.title,
    buildingName: typeof draft.buildingName === "string" ? draft.buildingName : EMPTY_FORM.buildingName,
    unitType: typeof draft.unitType === "string" && TYPES.includes(draft.unitType) ? draft.unitType : EMPTY_FORM.unitType,
    estate: typeof draft.estate === "string" ? draft.estate : EMPTY_FORM.estate,
    county: typeof draft.county === "string" ? draft.county : EMPTY_FORM.county,
    address: typeof draft.address === "string" ? draft.address : EMPTY_FORM.address,
    latitude: typeof draft.latitude === "string" ? draft.latitude : EMPTY_FORM.latitude,
    longitude: typeof draft.longitude === "string" ? draft.longitude : EMPTY_FORM.longitude,
    amenities: Array.isArray(draft.amenities) ? draft.amenities.filter((item): item is string => typeof item === "string" && AMENITIES.includes(item)) : EMPTY_FORM.amenities,
    status: LISTING_STATUSES.find((status) => status === draft.status) ?? EMPTY_FORM.status,
    availabilityDate: typeof draft.availabilityDate === "string" ? draft.availabilityDate : EMPTY_FORM.availabilityDate,
    rent: typeof draft.rent === "number" && Number.isFinite(draft.rent) && draft.rent >= 0 ? draft.rent : EMPTY_FORM.rent,
    depositRule: typeof draft.depositRule === "string" ? draft.depositRule : EMPTY_FORM.depositRule,
    description: typeof draft.description === "string" ? draft.description : EMPTY_FORM.description,
    tourUrl: typeof draft.tourUrl === "string" ? draft.tourUrl : EMPTY_FORM.tourUrl,
    photos: Array.isArray(draft.photos)
      ? draft.photos.filter((photo): photo is FormValues["photos"][number] => !!photo
        && typeof photo.name === "string"
        && typeof photo.dataUrl === "string"
        && photo.dataUrl.startsWith("data:image/webp;base64,"))
      : EMPTY_FORM.photos,
  };
}

async function compressPhoto(file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (image.width < 1 || image.height < 1 || image.width > 12000 || image.height > 12000 || image.width * image.height > 60000000) {
      throw new Error("Photo dimensions are too large to process safely.");
    }

    const scale = Math.min(1, 1600 / image.width, 1200 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot process images.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.64, 0.5, 0.4]) {
      const dataUrl = canvas.toDataURL("image/webp", quality);
      if (!dataUrl.startsWith("data:image/webp;base64,")) {
        throw new Error("This browser does not support WebP photo compression.");
      }
      if (dataUrl.length <= MAX_WEBP_DATA_URL_LENGTH) return dataUrl;
    }
    throw new Error("A photo is still too large after compression. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function LandlordListingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const draftKey = listingDraftKey(userId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setForm(restoreDraft(JSON.parse(saved)));
      }
    } catch (cause) {
      console.error("Unable to restore listing draft.", cause);
      setError("Your saved draft could not be restored. You can continue with a new listing.");
    } finally {
      setReady(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
      setMessage("Draft saved on this device");
    } catch (cause) {
      console.error("Unable to save listing draft.", cause);
      setMessage("");
      setError("Draft could not be saved. Remove some photos or free browser storage space.");
    }
  }, [form, ready]);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const addFiles = async (files: FileList | File[]) => {
    const remaining = MAX_PHOTOS - form.photos.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    if (selected.some((file) => !file.type.startsWith("image/") || file.size > MAX_SOURCE_PHOTO_BYTES)) {
      setError("Choose image files smaller than 20 MB.");
      return;
    }
    setSavingPhotos(true);
    setError("");
    try {
      const photos = await Promise.all(selected.map(async (file) => ({ name: file.name, dataUrl: await compressPhoto(file) })));
      setForm((current) => ({ ...current, photos: [...current.photos, ...photos] }));
    } catch (cause) {
      console.error("Unable to process listing photos.", cause);
      setError("One or more photos could not be processed. Try a different image.");
    } finally {
      setSavingPhotos(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const next = () => {
    if (step === 0 && (!form.title.trim() || !form.unitType)) {
      setError("Add a listing title and choose a unit type.");
      return;
    }
    if (step === 1 && (!form.estate.trim() || !form.address.trim())) {
      setError("Add the neighborhood and a more specific address.");
      return;
    }
    if (step === 1 && (!form.latitude || !form.longitude)) {
      setError("Choose the property's location by dropping a pin on the map.");
      return;
    }
    if (step === 1 && ((form.latitude && !form.longitude) || (!form.latitude && form.longitude)
      || (form.latitude && (!Number.isFinite(Number(form.latitude)) || Number(form.latitude) < -90 || Number(form.latitude) > 90))
      || (form.longitude && (!Number.isFinite(Number(form.longitude)) || Number(form.longitude) < -180 || Number(form.longitude) > 180)))) {
      setError("Enter both coordinates, with latitude from -90 to 90 and longitude from -180 to 180.");
      return;
    }
    if (step === 3 && form.rent <= 0) {
      setError("Enter a monthly rent greater than zero.");
      return;
    }
    if (step === 2 && form.status === "Soon available" && !form.availabilityDate) {
      setError("Choose the expected availability date.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const publish = async () => {
    if (!form.title.trim() || !form.estate.trim() || !form.address.trim() || !form.latitude || !form.longitude || form.rent <= 0) {
      setError("Complete the title, address, map pin, and monthly rent before saving your listing.");
      setStep(!form.title.trim() ? 0 : !form.estate.trim() || !form.address.trim() || !form.latitude || !form.longitude ? 1 : 3);
      return;
    }
    setSavingListing(true);
    setError("");
    const id = crypto.randomUUID();
    const photoPaths: string[] = [];
    try {
      for (const photo of form.photos) {
        const image = await fetch(photo.dataUrl);
        const file = await image.blob();
        const data = new FormData();
        data.append("image", file, "listing-photo.webp");
        const response = await fetch(`/api/landlord/listings/${id}/photos`, {
          method: "POST",
          body: data,
        });
        const result = await response.json() as { path?: string; error?: string };
        if (!response.ok || !result.path) throw new Error(result.error ?? "Photo upload failed.");
        photoPaths.push(result.path);
      }

      const response = await fetch("/api/landlord/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: form.title,
          buildingName: form.buildingName,
          unitType: form.unitType,
          estate: form.estate,
          county: form.county,
          address: form.address,
          latitude: form.latitude,
          longitude: form.longitude,
          amenities: form.amenities,
          status: form.status,
          availabilityDate: form.availabilityDate || null,
          rent: form.rent,
          depositRule: form.depositRule,
          description: form.description,
          tourUrl: form.tourUrl,
          photoPaths,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The listing could not be saved.");
      localStorage.removeItem(draftKey);
      router.push("/dashboard/landlord");
    } catch (cause) {
      console.error("Unable to save listing.", cause);
      if (photoPaths.length) {
        try {
          const response = await fetch(`/api/landlord/listings/${id}/photos`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoPaths }),
          });
          if (!response.ok) console.error("Unable to clean up photos after listing save failure.", await response.text());
        } catch (cleanupError) {
          console.error("Unable to clean up photos after listing save failure.", cleanupError);
        }
      }
      setError(cause instanceof Error ? cause.message : "Listing could not be saved. Please try again.");
    } finally {
      setSavingListing(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    update("amenities", form.amenities.includes(amenity)
      ? form.amenities.filter((item) => item !== amenity)
      : [...form.amenities, amenity]);
  };
  const movePhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.photos.length) return;
    const photos = [...form.photos];
    [photos[index], photos[nextIndex]] = [photos[nextIndex], photos[index]];
    update("photos", photos);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/dashboard/landlord" className="text-sm text-neutral-500 hover:underline">← Landlord dashboard</Link>
      <h1 className="mt-3 text-2xl font-semibold">List your keja</h1>
      <p className="mt-1 text-sm text-neutral-500">Add the details renters need to find their next home.</p>

      <ol aria-label="Listing steps" className="mt-6 grid grid-cols-5 gap-2">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined} className={`border-b-2 pb-2 text-center text-xs ${step === index ? "border-emerald-700 font-semibold text-emerald-800" : index < step ? "border-emerald-300 text-neutral-600" : "border-slate-200 text-neutral-400"}`}>
            <span className="block">{index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="step-title">
        <h2 id="step-title" className="text-lg font-semibold">{STEPS[step]}</h2>

        {step === 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium">Listing title
            <input className={inputClass} value={form.title} maxLength={90} placeholder="e.g. Bright bedsitter near the stage" onChange={(event) => update("title", event.target.value)} />
          </label>
          <label className="text-sm font-medium">Unit type
            <select className={inputClass} value={form.unitType} onChange={(event) => update("unitType", event.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          </label>
          <label className="text-sm font-medium">Building / estate name
            <input className={inputClass} value={form.buildingName} maxLength={80} placeholder="Optional building name" onChange={(event) => update("buildingName", event.target.value)} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium">Description
            <textarea className={inputClass} rows={4} maxLength={1200} value={form.description} placeholder="Describe the home and nearby conveniences" onChange={(event) => update("description", event.target.value)} />
          </label>
        </div>}

        {step === 1 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">County
            <input className={inputClass} value={form.county} onChange={(event) => update("county", event.target.value)} />
          </label>
          <label className="text-sm font-medium">Neighborhood / estate
            <input className={inputClass} value={form.estate} placeholder="e.g. Kilimani" onChange={(event) => update("estate", event.target.value)} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium">Address or directions
            <textarea className={inputClass} rows={3} value={form.address} placeholder="Street, landmark, or directions for a viewing" onChange={(event) => update("address", event.target.value)} />
          </label>
          <label className="text-sm font-medium">Latitude
            <input className={inputClass} type="number" step="any" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} />
          </label>
          <label className="text-sm font-medium">Longitude
            <input className={inputClass} type="number" step="any" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <InteractiveMap
              selectedPoint={form.latitude && form.longitude ? { lat: Number(form.latitude), lng: Number(form.longitude) } : null}
              selectable
              onSelect={(point) => {
                update("latitude", point.lat.toFixed(6));
                update("longitude", point.lng.toFixed(6));
              }}
              heightClassName="h-72 sm:h-80"
            />
            <p className="mt-2 text-xs text-neutral-500">Tap or drag the pin to the home's approximate location. The public map will show an approximate area, not your exact coordinates.</p>
          </div>
        </div>}

        {step === 2 && <fieldset className="mt-4">
          <legend className="text-sm text-neutral-600">Select all that apply.</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {AMENITIES.map((amenity) => <label key={amenity} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} className="h-4 w-4 accent-emerald-700" />{amenity}
            </label>)}
          </div>
          <label className="mt-5 block text-sm font-medium">Listing availability
            <select className={inputClass} value={form.status} onChange={(event) => {
              const status = LISTING_STATUSES.find((item) => item === event.target.value);
              if (status) update("status", status);
            }}>
              {LISTING_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          {form.status === "Soon available" && <label className="mt-4 block text-sm font-medium">Expected available date
            <input className={inputClass} type="date" min={new Date().toISOString().slice(0, 10)} required value={form.availabilityDate} onChange={(event) => update("availabilityDate", event.target.value)} />
          </label>}
        </fieldset>}

        {step === 3 && <div className="mt-4 grid gap-4">
          <label className="text-sm font-medium">Monthly rent (KSh)
            <input className={inputClass} type="number" min={1} step={100} value={form.rent || ""} onChange={(event) => update("rent", Number(event.target.value))} />
          </label>
          <label className="text-sm font-medium">Deposit and initial terms
            <input className={inputClass} maxLength={180} value={form.depositRule} placeholder="e.g. 1 Month Rent + 1 Month Deposit + Water Deposit" onChange={(event) => update("depositRule", event.target.value)} />
          </label>
          <p className="text-xs text-neutral-500">Be clear about all move-in costs. Keja Mtaani does not collect or hold deposits.</p>
        </div>}

        {step === 4 && <div className="mt-4">
          <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose listing photos" onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-sm hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <p className="font-medium">Drag photos here or choose files</p>
            <p className="mt-1 text-xs text-neutral-500">Up to {MAX_PHOTOS} images. Photos are compressed before secure upload.</p>
          </div>
          {savingPhotos && <p role="status" className="mt-3 text-sm text-neutral-600">Compressing photos…</p>}
          {form.photos.length > 0 && <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.photos.map((photo, index) => <li key={`${photo.name}-${index}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUrl} alt={`Listing photo ${index + 1}: ${photo.name}`} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <p className="mt-1 text-xs font-medium text-slate-600">{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</p>
              <div className="mt-1 flex gap-3">
                <button type="button" disabled={index === 0} onClick={() => movePhoto(index, -1)} className="text-xs text-emerald-800 underline disabled:opacity-40">Move earlier</button>
                <button type="button" disabled={index === form.photos.length - 1} onClick={() => movePhoto(index, 1)} className="text-xs text-emerald-800 underline disabled:opacity-40">Move later</button>
              </div>
              <button type="button" aria-label={`Remove ${photo.name}`} onClick={() => update("photos", form.photos.filter((_, photoIndex) => photoIndex !== index))} className="mt-1 text-xs text-rose-700 underline">Remove</button>
            </li>)}
          </ul>}
          <label className="mt-5 block text-sm font-medium">Video or virtual tour URL (optional)
            <input className={inputClass} type="url" value={form.tourUrl} placeholder="https://…" onChange={(event) => update("tourUrl", event.target.value)} />
          </label>
        </div>}

        <div aria-live="polite" className="mt-4 min-h-5 text-sm">
          {error && <p role="alert" className="text-rose-700">{error}</p>}
          {!error && message && <p className="text-emerald-700">{message}</p>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <button type="button" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">Back</button>
          {step < STEPS.length - 1
            ? <button type="button" onClick={next} className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800">Continue</button>
            : <button type="button" onClick={() => void publish()} disabled={savingPhotos || savingListing} className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{savingListing ? "Submitting…" : "Submit for review"}</button>}
        </div>
      </section>
      <p className="mt-4 text-xs text-neutral-500">Your draft is saved on this device. Submitted listings and photos are stored in your account and remain private until approved.</p>
    </main>
  );
}
