import { useEffect, useState, type ChangeEvent } from 'react';
import { divIcon, type DragEndEvent, type LatLngTuple, type Marker as LeafletMarker } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import styles from './LocationPicker.module.css';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Whole-India view until there is a pin; street level once there is one.
const INDIA_CENTER: LatLngTuple = [22.5, 79];
const INDIA_ZOOM = 5;
const PIN_ZOOM = 16;
// Below this zoom a pin is too coarse to trust, so a new pin zooms the map in.
const CLOSE_ZOOM = 13;

// Leaflet's default marker images don't survive bundling (their URLs are
// resolved at runtime), so the pin is drawn in CSS. Leaflet positions the
// marker element with its own inline transform, so the rotated teardrop is an
// inner element — putting the rotation on the outer one would be overwritten.
// iconAnchor is the tip of the rotated 24px square: 12px across, ~29px down.
const PIN_ICON = divIcon({
  className: styles.pinAnchor,
  html: `<span class="${styles.pin}"></span>`,
  iconSize: [24, 24],
  iconAnchor: [12, 29],
});

/** ~11 cm of precision — more digits would only be GPS noise. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

interface Draft {
  latitude: string;
  longitude: string;
}

function toDraft(value: Coordinates | null): Draft {
  return { latitude: value ? String(value.latitude) : '', longitude: value ? String(value.longitude) : '' };
}

function parseCoordinate(text: string, max: number): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null; // Number('') is 0 — an empty box must not become the equator.
  const value = Number(trimmed);
  return Number.isFinite(value) && Math.abs(value) <= max ? value : null;
}

/** Both boxes as a valid pair, or null — half a location is no location. */
function parseDraft(draft: Draft): Coordinates | null {
  const latitude = parseCoordinate(draft.latitude, 90);
  const longitude = parseCoordinate(draft.longitude, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

/** Does the text already say `value`? Then leave it alone rather than reformat mid-typing. */
function draftMatches(draft: Draft, value: Coordinates | null): boolean {
  const parsed = parseDraft(draft);
  if (!value) return parsed === null;
  return parsed?.latitude === value.latitude && parsed.longitude === value.longitude;
}

/** Places the pin wherever the map is clicked. */
function ClickToPlace({ onPick }: { onPick: (coords: Coordinates) => void }) {
  useMapEvents({
    click: (event) => onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) }),
  });
  return null;
}

/**
 * Brings a new pin into view — from "Use my current location", the typed
 * coordinates, or a first rough click on the zoomed-out map — without jumping
 * the map around for small drags that are already on screen.
 */
function FollowPin({ value }: { value: Coordinates | null }) {
  const map = useMap();
  const latitude = value?.latitude;
  const longitude = value?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    if (map.getZoom() < CLOSE_ZOOM || !map.getBounds().contains([latitude, longitude])) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM));
    }
  }, [map, latitude, longitude]);

  return null;
}

interface LocationPickerProps {
  value: Coordinates | null;
  /** null while the typed coordinates aren't a valid pair. */
  onChange?: (value: Coordinates | null) => void;
  /** Show the pin without letting it move (the branch page's view mode). */
  readOnly?: boolean;
}

/**
 * OpenStreetMap map for a branch's exact location. Three ways to set it:
 * click the map, drag the pin, or type the coordinates (e.g. copied from
 * Google Maps) — plus "Use my current location" for an admin standing at the
 * branch. Map data © OpenStreetMap contributors; the attribution is required.
 */
export function LocationPicker({ value, onChange, readOnly = false }: LocationPickerProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(value));
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Keep the boxes in step with pins placed on the map.
  useEffect(() => {
    setDraft((current) => (draftMatches(current, value) ? current : toDraft(value)));
  }, [value]);

  function pick(coords: Coordinates) {
    setGeoError(null);
    onChange?.(coords);
  }

  function handleDraftChange(field: keyof Draft) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...draft, [field]: event.target.value };
      setDraft(next);
      onChange?.(parseDraft(next));
    };
  }

  function handleUseMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeoError("This browser can't share its location. Place the pin on the map instead.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        pick({ latitude: round(position.coords.latitude), longitude: round(position.coords.longitude) });
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was blocked. Allow it in your browser settings, or place the pin on the map.'
            : "Couldn't get your location. Place the pin on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const position: LatLngTuple | null = value ? [value.latitude, value.longitude] : null;

  return (
    <div className={styles.picker}>
      <MapContainer
        center={position ?? INDIA_CENTER}
        zoom={position ? PIN_ZOOM : INDIA_ZOOM}
        className={styles.map}
        scrollWheelZoom={!readOnly}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {position && (
          <Marker
            position={position}
            icon={PIN_ICON}
            draggable={!readOnly}
            eventHandlers={{
              dragend: (event: DragEndEvent) => {
                const { lat, lng } = (event.target as LeafletMarker).getLatLng();
                pick({ latitude: round(lat), longitude: round(lng) });
              },
            }}
          />
        )}
        {!readOnly && <ClickToPlace onPick={pick} />}
        <FollowPin value={value} />
      </MapContainer>

      {!readOnly && (
        <>
          <div className={styles.toolbar}>
            <Button type="button" variant="secondary" size="sm" onClick={handleUseMyLocation} disabled={locating}>
              {locating ? 'Finding you…' : 'Use my current location'}
            </Button>
            <p className={styles.hint}>
              Click the map to drop the pin, then drag it onto the branch's main entrance.
            </p>
          </div>
          {geoError && (
            <p role="alert" className={styles.geoError}>
              {geoError}
            </p>
          )}
          <div className={styles.coords}>
            <FormField
              label="Latitude"
              value={draft.latitude}
              onChange={handleDraftChange('latitude')}
              placeholder="18.520430"
              inputMode="decimal"
            />
            <FormField
              label="Longitude"
              value={draft.longitude}
              onChange={handleDraftChange('longitude')}
              placeholder="73.856743"
              inputMode="decimal"
            />
          </div>
        </>
      )}
    </div>
  );
}
