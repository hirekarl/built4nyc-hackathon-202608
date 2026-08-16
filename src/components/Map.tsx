"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import {
  candidatesFeatureCollection,
  centerlinesFeatureCollection,
  fetchEligibleCenterlines,
  groupIntersectionCandidates,
  type CenterlineBounds,
  type IntersectionCandidate,
} from "../lib/centerline-client";
import { createCircleFeature } from "../lib/geometry";
import type { IntersectionSelection } from "../types/report";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const CENTERLINE_SOURCE_ID = "eligible-centerlines";
const INTERSECTION_SOURCE_ID = "intersection-candidates";
const BOUNDARY_SOURCE_ID = "selected-intersection-boundary";
const CENTERLINE_LAYER_ID = "eligible-centerline-lines";
const SELECTED_CENTERLINE_LAYER_ID = "selected-centerline-lines";
const INTERSECTION_HIT_LAYER_ID = "intersection-hit-targets";
const INTERSECTION_MARKER_LAYER_ID = "intersection-markers";
const INTERSECTION_HOVER_LAYER_ID = "intersection-hover-focus-marker";
const SELECTED_INTERSECTION_LAYER_ID = "selected-intersection-candidate";
const BOUNDARY_FILL_LAYER_ID = "selected-boundary-fill";
const BOUNDARY_OUTLINE_LAYER_ID = "selected-boundary-outline";
const PROXY_LIST_ID = "intersection-keyboard-proxy";
const PAGE_SIZE = 12;

const emptyFeatureCollection: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [],
};

export interface MapProps {
  onSelect: (selection: IntersectionSelection) => void;
}

function boundsFromMap(map: maplibregl.Map): CenterlineBounds {
  const bounds = map.getBounds();
  return {
    north: bounds.getNorth(),
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function candidateIndex(feature: MapGeoJSONFeature | undefined): number | null {
  const value = feature?.properties?.candidateIndex;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function candidateKey(candidate: IntersectionCandidate): string {
  return [
    candidate.coordinate.latitude,
    candidate.coordinate.longitude,
    candidate.level,
    ...candidate.physicalIds,
  ].join("|");
}

function distanceFromCenter(
  candidate: IntersectionCandidate,
  center: { lat: number; lng: number },
): number {
  const latitudeScale = Math.cos((center.lat * Math.PI) / 180);
  const latitudeDelta = candidate.coordinate.latitude - center.lat;
  const longitudeDelta =
    (candidate.coordinate.longitude - center.lng) * latitudeScale;
  return Math.hypot(latitudeDelta, longitudeDelta);
}

function sortCandidates(
  candidates: IntersectionCandidate[],
  center: { lat: number; lng: number },
): IntersectionCandidate[] {
  return [...candidates].sort((left, right) => {
    const distanceDifference =
      distanceFromCenter(left, center) - distanceFromCenter(right, center);
    if (Math.abs(distanceDifference) > 0.0000001) return distanceDifference;

    const nameDifference = left.displayName.localeCompare(right.displayName);
    if (nameDifference !== 0) return nameDifference;
    if (left.coordinate.latitude !== right.coordinate.latitude) {
      return left.coordinate.latitude - right.coordinate.latitude;
    }
    return left.coordinate.longitude - right.coordinate.longitude;
  });
}

function proxyAccessibleName(candidate: IntersectionCandidate): string {
  return `${candidate.displayName}, ${candidate.coordinate.latitude.toFixed(6)}, ${candidate.coordinate.longitude.toFixed(6)}`;
}

export default function Map({ onSelect }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const candidatesRef = useRef<IntersectionCandidate[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const selectedKeyRef = useRef<string | null>(null);
  const [candidates, setCandidates] = useState<IntersectionCandidate[]>([]);
  const [proxyExpanded, setProxyExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);

  const selectCandidate = useCallback(
    (candidate: IntersectionCandidate) => {
      const map = mapRef.current;
      if (!map) return;

      const selection: IntersectionSelection = {
        kind: "intersection",
        displayName: candidate.displayName,
        coordinate: candidate.coordinate,
        streetNames: [...candidate.streetNames],
        physicalIds: [...candidate.physicalIds],
      };
      const boundarySource = map.getSource(BOUNDARY_SOURCE_ID) as
        GeoJSONSource | undefined;
      boundarySource?.setData(createCircleFeature(selection.coordinate, 50));
      map.setFilter(SELECTED_CENTERLINE_LAYER_ID, [
        "in",
        ["get", "physicalId"],
        ["literal", candidate.physicalIds],
      ]);
      const index = candidatesRef.current.findIndex(
        (currentCandidate) =>
          candidateKey(currentCandidate) === candidateKey(candidate),
      );
      map.setFilter(SELECTED_INTERSECTION_LAYER_ID, [
        "==",
        ["get", "candidateIndex"],
        index,
      ]);
      const nextSelectedKey = candidateKey(candidate);
      selectedKeyRef.current = nextSelectedKey;
      setSelectedKey(nextSelectedKey);
      onSelect(selection);
    },
    [onSelect],
  );

  const indicateCandidate = useCallback(
    (index: number, candidate: IntersectionCandidate) => {
      const map = mapRef.current;
      if (!map) return;
      map.setFilter(INTERSECTION_HOVER_LAYER_ID, [
        "==",
        ["get", "candidateIndex"],
        index,
      ]);
      setHoveredName(candidate.displayName);
    },
    [],
  );

  const clearCandidateIndication = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setFilter(INTERSECTION_HOVER_LAYER_ID, [
      "==",
      ["get", "candidateIndex"],
      -1,
    ]);
    setHoveredName(null);
  }, []);

  const loadViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(false);
    setEmpty(false);
    setVisibleCount(PAGE_SIZE);
    setCandidates([]);
    candidatesRef.current = [];
    if (map.getLayer(INTERSECTION_HOVER_LAYER_ID)) {
      clearCandidateIndication();
    }

    try {
      const centerlines = await fetchEligibleCenterlines(boundsFromMap(map), {
        signal: controller.signal,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const nextCandidates = sortCandidates(
        groupIntersectionCandidates(centerlines),
        map.getCenter(),
      );
      const lockedKey = selectedKeyRef.current;
      const selectedIndex =
        lockedKey === null
          ? -1
          : nextCandidates.findIndex(
              (candidate) => candidateKey(candidate) === lockedKey,
            );
      candidatesRef.current = nextCandidates;
      setCandidates(nextCandidates);
      (
        map.getSource(CENTERLINE_SOURCE_ID) as GeoJSONSource | undefined
      )?.setData(centerlinesFeatureCollection(centerlines));
      (
        map.getSource(INTERSECTION_SOURCE_ID) as GeoJSONSource | undefined
      )?.setData(candidatesFeatureCollection(nextCandidates));
      map.setFilter(SELECTED_INTERSECTION_LAYER_ID, [
        "==",
        ["get", "candidateIndex"],
        selectedIndex,
      ]);
      setEmpty(nextCandidates.length === 0);
    } catch (loadError) {
      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current ||
        isAbortError(loadError)
      ) {
        return;
      }
      candidatesRef.current = [];
      setCandidates([]);
      (
        map.getSource(CENTERLINE_SOURCE_ID) as GeoJSONSource | undefined
      )?.setData(emptyFeatureCollection);
      (
        map.getSource(INTERSECTION_SOURCE_ID) as GeoJSONSource | undefined
      )?.setData(emptyFeatureCollection);
      setError(true);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [clearCandidateIndication]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    mountedRef.current = true;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [-73.9802, 40.7525],
      zoom: 14.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const handleLoad = () => {
      map.addSource(CENTERLINE_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection,
      });
      map.addSource(INTERSECTION_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection,
      });
      map.addSource(BOUNDARY_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection,
      });

      map.addLayer({
        id: CENTERLINE_LAYER_ID,
        type: "line",
        source: CENTERLINE_SOURCE_ID,
        paint: {
          "line-color": "#52606d",
          "line-opacity": 0.28,
          "line-width": 1.25,
        },
      });
      map.addLayer({
        id: BOUNDARY_FILL_LAYER_ID,
        type: "fill",
        source: BOUNDARY_SOURCE_ID,
        paint: {
          "fill-color": "#c2410c",
          "fill-opacity": 0.14,
        },
      });
      map.addLayer({
        id: SELECTED_CENTERLINE_LAYER_ID,
        type: "line",
        source: CENTERLINE_SOURCE_ID,
        filter: ["in", ["get", "physicalId"], ["literal", []]],
        paint: {
          "line-color": "#c2410c",
          "line-opacity": 0.94,
          "line-width": 5,
        },
      });
      map.addLayer({
        id: INTERSECTION_MARKER_LAYER_ID,
        type: "circle",
        source: INTERSECTION_SOURCE_ID,
        paint: {
          "circle-color": "#52606d",
          "circle-opacity": 0.42,
          "circle-radius": 2.5,
        },
      });
      map.addLayer({
        id: INTERSECTION_HOVER_LAYER_ID,
        type: "circle",
        source: INTERSECTION_SOURCE_ID,
        filter: ["==", ["get", "candidateIndex"], -1],
        paint: {
          "circle-color": "#52606d",
          "circle-opacity": 0.68,
          "circle-radius": 5,
        },
      });
      map.addLayer({
        id: BOUNDARY_OUTLINE_LAYER_ID,
        type: "line",
        source: BOUNDARY_SOURCE_ID,
        paint: {
          "line-color": "#c2410c",
          "line-opacity": 0.95,
          "line-width": 3,
        },
      });
      map.addLayer({
        id: SELECTED_INTERSECTION_LAYER_ID,
        type: "circle",
        source: INTERSECTION_SOURCE_ID,
        filter: ["==", ["get", "candidateIndex"], -1],
        paint: {
          "circle-color": "#c2410c",
          "circle-opacity": 1,
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: INTERSECTION_HIT_LAYER_ID,
        type: "circle",
        source: INTERSECTION_SOURCE_ID,
        paint: {
          "circle-color": "#000000",
          "circle-opacity": 0,
          "circle-radius": 34,
        },
      });
      void loadViewport();
    };

    const handleEnter = (event: { features?: MapGeoJSONFeature[] }) => {
      const index = candidateIndex(event.features?.[0]);
      const candidate =
        index === null ? undefined : candidatesRef.current[index];
      if (!candidate || index === null) {
        map.getCanvas().style.cursor = "";
        clearCandidateIndication();
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      indicateCandidate(index, candidate);
    };

    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      clearCandidateIndication();
    };

    const handleClick = (event: { features?: MapGeoJSONFeature[] }) => {
      const index = candidateIndex(event.features?.[0]);
      const candidate =
        index === null ? undefined : candidatesRef.current[index];
      if (!candidate) return;
      selectCandidate(candidate);
    };

    map.on("load", handleLoad);
    map.on("moveend", loadViewport);
    map.on("mouseenter", INTERSECTION_HIT_LAYER_ID, handleEnter);
    map.on("mouseleave", INTERSECTION_HIT_LAYER_ID, handleLeave);
    map.on("click", INTERSECTION_HIT_LAYER_ID, handleClick);

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      map.off("load", handleLoad);
      map.off("moveend", loadViewport);
      map.off("mouseenter", INTERSECTION_HIT_LAYER_ID, handleEnter);
      map.off("mouseleave", INTERSECTION_HIT_LAYER_ID, handleLeave);
      map.off("click", INTERSECTION_HIT_LAYER_ID, handleClick);
      map.remove();
      mapRef.current = null;
    };
  }, [
    clearCandidateIndication,
    indicateCandidate,
    loadViewport,
    selectCandidate,
  ]);

  const visibleCandidates = candidates.slice(0, visibleCount);
  const candidateStatus = `${candidates.length} eligible intersection${candidates.length === 1 ? "" : "s"} in this map view.`;

  return (
    <section className="street-map" aria-label="Street intersection map">
      <div ref={containerRef} className="maplibre-canvas" />
      <div className="map-floating-controls">
        <button
          type="button"
          className="intersection-proxy-toggle"
          aria-expanded={proxyExpanded}
          aria-controls={PROXY_LIST_ID}
          onClick={() => setProxyExpanded((expanded) => !expanded)}
        >
          Choose an intersection without using the map
        </button>

        <div
          id={PROXY_LIST_ID}
          className="intersection-proxy-popover"
          hidden={!proxyExpanded}
        >
          {proxyExpanded && candidates.length > 0 && (
            <>
              <ul
                className="intersection-proxy-list"
                aria-label="Intersections in this map view"
              >
                {visibleCandidates.map((candidate, index) => (
                  <li key={candidateKey(candidate)}>
                    <button
                      type="button"
                      aria-label={proxyAccessibleName(candidate)}
                      aria-pressed={selectedKey === candidateKey(candidate)}
                      onFocus={() => indicateCandidate(index, candidate)}
                      onBlur={clearCandidateIndication}
                      onClick={() => selectCandidate(candidate)}
                    >
                      <span>{candidate.displayName}</span>
                      <small>
                        {candidate.coordinate.latitude.toFixed(6)},{" "}
                        {candidate.coordinate.longitude.toFixed(6)}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              {visibleCount < candidates.length && (
                <button
                  type="button"
                  className="show-more-intersections"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show more intersections
                </button>
              )}
            </>
          )}
        </div>

        <div className="map-status" aria-live="polite">
          {hoveredName && <p>{hoveredName}</p>}
          {loading && <p role="status">Loading street data…</p>}
          {!loading && !error && !empty && (
            <p role="status">{candidateStatus}</p>
          )}
          {!loading && !error && empty && (
            <p role="status">No eligible intersections in this map view.</p>
          )}
        </div>
        {error && (
          <div role="alert">
            <p>Street data could not be loaded.</p>
            <button type="button" onClick={() => void loadViewport()}>
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
