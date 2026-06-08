import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchAssignmentsBySurveyPeriodId } from "@/services/assignment";
import { fetchGeoJsonFeatureByKey } from "@/services/geojson";
import { fetchSurveyRegionLogs, fetchSurveyRegions } from "@/services/region";
import { fetchSurveyByPeriodId } from "@/services/survey";
import { API_ORIGIN } from "@/lib/http-client";
import { type Assignment, type AssignmentLogPoint } from "@/types/assignment";
import type { GeoJsonFeature } from "@/types/geojson";
import type { Survey } from "@/types/survey";
import type { SurveyRegion } from "@/types/region";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPathwayDeltaTime(fromValue: string, toValue: string): string {
  const from = new Date(fromValue).getTime();
  const to = new Date(toValue).getTime();

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return "Δ -";
  }

  let diffMs = Math.max(0, to - from);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const secondMs = 1000;

  const days = Math.floor(diffMs / dayMs);
  diffMs %= dayMs;
  const hours = Math.floor(diffMs / hourMs);
  diffMs %= hourMs;
  const minutes = Math.floor(diffMs / minuteMs);
  diffMs %= minuteMs;
  const seconds = Math.floor(diffMs / secondMs);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}h`);
  }
  if (hours > 0) {
    parts.push(`${hours}j`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}d`);
  }

  return `Δ ${parts.join(" ")}`;
}

function getPathwayTime(assignment: Assignment): {
  value: string;
  source: "started_at" | "opened_at" | "submitted_at";
} {
  if (assignment.started_at && assignment.started_at.trim() !== "") {
    return { value: assignment.started_at, source: "started_at" };
  }

  if (assignment.opened_at && assignment.opened_at.trim() !== "") {
    return { value: assignment.opened_at, source: "opened_at" };
  }

  return { value: assignment.submitted_at, source: "submitted_at" };
}

function getArrowAngleDeg(
  from: [number, number],
  to: [number, number],
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;

  const lat1 = toRadians(from[0]);
  const lat2 = toRadians(to[0]);
  const deltaLon = toRadians(to[1] - from[1]);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearingFromNorth = (toDegrees(Math.atan2(y, x)) + 360) % 360;

  // CSS arrow base points to the right (east), so shift from north-based bearing.
  return bearingFromNorth - 90;
}

function normalizeCoordinateRing(rawRing: unknown): [number, number][] {
  if (!Array.isArray(rawRing)) {
    return [];
  }

  const result: [number, number][] = [];
  for (const item of rawRing) {
    if (!Array.isArray(item) || item.length < 2) {
      continue;
    }

    const lon = Number(item[0]);
    const lat = Number(item[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      result.push([lon, lat]);
    }
  }

  return result;
}

function isPointInRing(
  point: [number, number],
  ring: [number, number][],
): boolean {
  if (ring.length < 3) {
    return false;
  }

  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInsidePolygon(
  point: [number, number],
  polygonRingsRaw: unknown,
): boolean {
  if (!Array.isArray(polygonRingsRaw) || polygonRingsRaw.length === 0) {
    return false;
  }

  const outerRing = normalizeCoordinateRing(polygonRingsRaw[0]);
  if (!isPointInRing(point, outerRing)) {
    return false;
  }

  // Exclude points that fall inside polygon holes.
  for (let i = 1; i < polygonRingsRaw.length; i++) {
    const holeRing = normalizeCoordinateRing(polygonRingsRaw[i]);
    if (isPointInRing(point, holeRing)) {
      return false;
    }
  }

  return true;
}

function isPointInsideRegionBoundary(
  lat: number,
  lon: number,
  feature: GeoJsonFeature | null,
): boolean {
  if (!feature) {
    return false;
  }

  const point: [number, number] = [lon, lat];
  const geometry = feature.geometry;

  if (geometry.type === "Polygon") {
    return isPointInsidePolygon(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    for (const polygon of geometry.coordinates) {
      if (isPointInsidePolygon(point, polygon)) {
        return true;
      }
    }
  }

  return false;
}

type SelectedPointDetail = {
  assignmentId: string;
  sequence: number;
  pointTypeLabel: string;
  zoneLabel: string;
  lat: number;
  lon: number;
  pathwayAt: string;
  pathwaySource: "started_at" | "opened_at" | "submitted_at";
  isViolation: boolean;
  violationScore: number;
};

type CoordinatePoint = {
  lat: number;
  lon: number;
  proportion: number;
};

type ViolationRadiusDetail = {
  assignmentId: string;
  locations: CoordinatePoint[];
};

function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInputValue(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toDateInputValue(parsed);
}

const SurveyRegionDetailPage = () => {
  const { surveyPeriodId = "", regionFullCode = "" } = useParams();
  const defaultDateFrom = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return toDateInputValue(startOfYear);
  }, []);
  const defaultDateTo = useMemo(() => {
    const now = new Date();
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    return toDateInputValue(endOfYear);
  }, []);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [region, setRegion] = useState<SurveyRegion | null>(null);
  const [regionBoundaryFeature, setRegionBoundaryFeature] =
    useState<GeoJsonFeature | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [regionLogs, setRegionLogs] = useState<AssignmentLogPoint[]>([]);
  const [logsDateFrom, setLogsDateFrom] = useState(defaultDateFrom);
  const [logsDateTo, setLogsDateTo] = useState(defaultDateTo);
  const [deltaMaxMinutes, setDeltaMaxMinutes] = useState("30");
  const [appliedLogsDateFrom, setAppliedLogsDateFrom] =
    useState(defaultDateFrom);
  const [appliedLogsDateTo, setAppliedLogsDateTo] = useState(defaultDateTo);
  const [appliedDeltaMaxMinutes, setAppliedDeltaMaxMinutes] = useState("30");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [activeLogIndex, setActiveLogIndex] = useState<number | null>(null);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const [hasAppliedLogsFilter, setHasAppliedLogsFilter] = useState(false);
  const [selectedLogsAssignmentId, setSelectedLogsAssignmentId] = useState<
    string | null
  >(null);
  const [selectedPointDetail, setSelectedPointDetail] =
    useState<SelectedPointDetail | null>(null);
  const [selectedViolationRadiusDetail, setSelectedViolationRadiusDetail] =
    useState<ViolationRadiusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backendOrigin = useMemo(() => API_ORIGIN, []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const violationRadiusLayerRef = useRef<L.LayerGroup | null>(null);
  const preserveMapViewportRef = useRef(false);

  const timelineLogs = useMemo(
    () =>
      regionLogs
        .filter(
          (logPoint) =>
            Number.isFinite(logPoint.latitude) &&
            Number.isFinite(logPoint.longitude),
        )
        .sort(
          (a, b) =>
            new Date(a.actioned_at).getTime() -
            new Date(b.actioned_at).getTime(),
        ),
    [regionLogs],
  );

  const focusedTimelineLogs = useMemo(
    () =>
      selectedLogsAssignmentId
        ? timelineLogs.filter(
            (logPoint) => logPoint.assignment_id === selectedLogsAssignmentId,
          )
        : timelineLogs,
    [selectedLogsAssignmentId, timelineLogs],
  );

  const parsedAppliedDeltaMaxMinutes = useMemo(() => {
    const trimmed = appliedDeltaMaxMinutes.trim();
    if (trimmed === "") {
      return null;
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return value;
  }, [appliedDeltaMaxMinutes]);

  const violationCentersByAssignment = useMemo<
    Record<string, CoordinatePoint[]>
  >(() => {
    const result: Record<string, CoordinatePoint[]> = {};

    for (const assignment of assignments) {
      const validLocations = (assignment.locations || [])
        .filter(
          (location) =>
            Number.isFinite(location.latitude) &&
            Number.isFinite(location.longitude) &&
            !(location.latitude === 0 && location.longitude === 0),
        )
        .map((location) => ({
          lat: location.latitude,
          lon: location.longitude,
          proportion: location.proportion,
        }));

      if (validLocations.length === 0) {
        continue;
      }

      result[assignment.assignment_id] = validLocations;
    }

    return result;
  }, [assignments]);

  const initialZoom = 19;
  const singlePointZoom = 23;
  const fitBoundsMaxZoom = 23;

  const assignmentPoints = useMemo(
    () =>
      assignments
        .filter(
          (assignment) =>
            Number.isFinite(assignment.latitude) &&
            Number.isFinite(assignment.longitude),
        )
        .filter(
          (assignment) =>
            !(assignment.latitude === 0 && assignment.longitude === 0),
        )
        .map((assignment) => {
          const pathwayTime = getPathwayTime(assignment);
          const isViolation = assignment.is_violation;
          const violationScore = assignment.violation_score ?? 0;

          return {
            id: assignment.id,
            assignmentId: assignment.assignment_id,
            lat: assignment.latitude,
            lon: assignment.longitude,
            pathwayAt: pathwayTime.value,
            pathwaySource: pathwayTime.source,
            isViolation,
            violationScore,
          };
        })
        .sort(
          (a, b) =>
            new Date(a.pathwayAt).getTime() - new Date(b.pathwayAt).getTime(),
        )
        .map((point, index) => ({
          ...point,
          sequence: index + 1,
        })),
    [assignments],
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (assignmentPoints.length === 0) {
      return [-0.128, 117.484];
    }

    const total = assignmentPoints.reduce(
      (acc, point) => {
        acc.lat += point.lat;
        acc.lon += point.lon;
        return acc;
      },
      { lat: 0, lon: 0 },
    );

    return [
      total.lat / assignmentPoints.length,
      total.lon / assignmentPoints.length,
    ];
  }, [assignmentPoints]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        maxZoom: 24,
      }).setView(mapCenter, initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 24,
        maxNativeZoom: 19,
        crossOrigin: true,
      }).addTo(mapRef.current);

      markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) {
      return;
    }

    markerLayer.clearLayers();
    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
      boundaryLayerRef.current = null;
    }

    const latLngs: L.LatLngExpression[] = [];
    const timelineLatLngsForBounds: L.LatLngExpression[] = [];
    const pointMarkers: L.CircleMarker[] = [];
    const segmentLayers: Array<{ from: number; to: number; line: L.Polyline }> =
      [];
    const arrowLayers: Array<{ segmentIndex: number; marker: L.Marker }> = [];
    let animationFrameId: number | null = null;
    let logAnimationFrameId: number | null = null;
    let animatedStartSegmentIndex: number | null = null;
    let animationDashOffset = 0;
    let animationHeadSegmentFloat = 0;
    let lastAnimationTimestamp = 0;
    let animationPauseUntilTimestamp = 0;
    let logAnimationDashOffset = 0;
    let logAnimationWavePhase = 0;
    let lastLogAnimationTimestamp = 0;
    const headAdvanceSpeedPerMs = 0.0009;
    const dashShiftSpeedPerMs = 0.035;
    const loopPauseMs = 850;
    const logDashShiftSpeedPerMs = 0.04;
    const logChevronWaveSpeedPerMs = 0.006;

    for (let index = 0; index < assignmentPoints.length; index++) {
      const point = assignmentPoints[index];
      const latLng: L.LatLngExpression = [point.lat, point.lon];
      latLngs.push(latLng);

      const isInsideBoundary = isPointInsideRegionBoundary(
        point.lat,
        point.lon,
        regionBoundaryFeature,
      );
      const isStartPoint = index === 0;
      const isEndPoint = index === assignmentPoints.length - 1;
      const markerColor = isInsideBoundary ? "#16a34a" : "#dc2626";
      const markerRadius = 8;
      const zoneLabel = isInsideBoundary ? "Di dalam area" : "Di luar area";
      const violationLabel = point.isViolation
        ? `Ya (${(point.violationScore * 100).toFixed(2)}%)`
        : "Tidak";
      const pointTypeLabel =
        isStartPoint && isEndPoint
          ? "Titik Awal & Akhir"
          : isStartPoint
            ? "Titik Awal"
            : isEndPoint
              ? "Titik Akhir"
              : "Titik Jalur";
      const pointDetail: SelectedPointDetail = {
        assignmentId: point.assignmentId,
        sequence: point.sequence,
        pointTypeLabel,
        zoneLabel,
        lat: point.lat,
        lon: point.lon,
        pathwayAt: point.pathwayAt,
        pathwaySource: point.pathwaySource,
        isViolation: point.isViolation,
        violationScore: point.violationScore,
      };

      const circleMarker = L.circleMarker(latLng, {
        radius: markerRadius,
        weight: 2,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.75,
      })
        .on("click", () => {
          preserveMapViewportRef.current = true;
          setSelectedPointDetail(pointDetail);
          if (point.isViolation) {
            updateViolationRadiusByAssignment(point.assignmentId);
          } else {
            updateViolationRadiusLayer(point.assignmentId, []);
            setSelectedViolationRadiusDetail(null);
            setSelectedLogsAssignmentId(null);
          }
        })
        .bindPopup(
          `<strong>${point.assignmentId}</strong><br/>Urutan: ${point.sequence}<br/>Posisi Pathway: ${pointTypeLabel}<br/>Zona: ${zoneLabel}<br/>Violation: ${violationLabel}<br/>Lat: ${point.lat.toFixed(6)}<br/>Lon: ${point.lon.toFixed(6)}<br/>Waktu Pathway (${point.pathwaySource}): ${formatDate(point.pathwayAt)}`,
        )
        .addTo(markerLayer);
      pointMarkers.push(circleMarker);

      if (point.isViolation) {
        L.circleMarker(latLng, {
          radius: 12,
          color: "#f59e0b",
          weight: 2,
          fillOpacity: 0,
          opacity: 0.95,
        })
          .on("mouseover", () => {
            applyPointFocus(index);
          })
          .on("mouseout", () => {
            applyPointFocus(null);
          })
          .on("click", () => {
            preserveMapViewportRef.current = true;
            setSelectedPointDetail(pointDetail);
            updateViolationRadiusByAssignment(point.assignmentId);
          })
          .bindPopup(
            `<strong>${point.assignmentId}</strong><br/>Status: Violation<br/>Klik ring untuk lihat titik logs.`,
          )
          .addTo(markerLayer);
      }

      if (isStartPoint || isEndPoint) {
        const endpointText =
          isStartPoint && isEndPoint ? "A/K" : isStartPoint ? "A" : "K";

        L.marker(latLng, {
          icon: L.divIcon({
            className: "pathway-endpoint-icon",
            html: `<span class="pathway-endpoint" style="background:${markerColor}">${endpointText}</span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(markerLayer);
      }
    }

    if (regionBoundaryFeature) {
      const geoLayer = L.geoJSON(
        regionBoundaryFeature as GeoJSON.GeoJsonObject,
        {
          interactive: false,
          style: {
            color: "#2563eb",
            weight: 2,
            fillColor: "#60a5fa",
            fillOpacity: 0.15,
          },
        },
      ).addTo(map);
      geoLayer.bringToBack();
      boundaryLayerRef.current = geoLayer;
    }

    if (latLngs.length > 1) {
      // Add per-segment pathway so hover can highlight only the related segment(s).
      for (let i = 0; i < latLngs.length - 1; i++) {
        const from = latLngs[i] as [number, number];
        const to = latLngs[i + 1] as [number, number];
        const fromPoint = assignmentPoints[i];
        const toPoint = assignmentPoints[i + 1];

        const segmentLine = L.polyline([from, to], {
          color: "#ef4444",
          weight: 2,
          opacity: 0.75,
        }).addTo(markerLayer);

        const fromTime = new Date(fromPoint.pathwayAt).getTime();
        const toTime = new Date(toPoint.pathwayAt).getTime();
        const deltaMinutes =
          Number.isFinite(fromTime) && Number.isFinite(toTime)
            ? Math.max(0, (toTime - fromTime) / 60000)
            : Number.POSITIVE_INFINITY;
        const shouldShowDeltaTooltip =
          parsedAppliedDeltaMaxMinutes === null ||
          deltaMinutes <= parsedAppliedDeltaMaxMinutes;

        if (shouldShowDeltaTooltip) {
          segmentLine.bindTooltip(
            formatPathwayDeltaTime(fromPoint.pathwayAt, toPoint.pathwayAt),
            {
              permanent: true,
              direction: "center",
              className: "pathway-delta-tooltip",
              offset: L.point(0, -2),
            },
          );
        }
        segmentLayers.push({ from: i, to: i + 1, line: segmentLine });

        const angleDeg = getArrowAngleDeg(from, to);

        // Render two direction chevrons per segment to make the flow clearer.
        const chevronRatios = [0.3, 0.7];
        for (const chevronRatio of chevronRatios) {
          const midLat = from[0] + (to[0] - from[0]) * chevronRatio;
          const midLon = from[1] + (to[1] - from[1]) * chevronRatio;

          const arrowMarker = L.marker([midLat, midLon], {
            icon: L.divIcon({
              className: "pathway-arrow-icon",
              html: `<span class="pathway-arrow-wrap" style="transform: rotate(${angleDeg}deg)"><span class="pathway-arrow"></span></span>`,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
            zIndexOffset: 800,
            interactive: false,
            keyboard: false,
          }).addTo(markerLayer);

          arrowLayers.push({ segmentIndex: i, marker: arrowMarker });
        }
      }
    }

    if (focusedTimelineLogs.length > 0) {
      const logLatLngs: L.LatLngExpression[] = [];
      const logPointLayers: L.CircleMarker[] = [];
      const logSegmentLayers: L.Polyline[] = [];
      const logChevronLayers: Array<{
        segmentIndex: number;
        marker: L.Marker;
      }> = [];

      for (
        let logIndex = 0;
        logIndex < focusedTimelineLogs.length;
        logIndex++
      ) {
        const logPoint = focusedTimelineLogs[logIndex];
        const isActiveLogPoint = activeLogIndex === logIndex;

        const logLatLng: L.LatLngExpression = [
          logPoint.latitude,
          logPoint.longitude,
        ];
        logLatLngs.push(logLatLng);
        timelineLatLngsForBounds.push(logLatLng);

        const logMarker = L.circleMarker(logLatLng, {
          radius: isActiveLogPoint ? 7 : 5,
          color: isActiveLogPoint ? "#0369a1" : "#0284c7",
          fillColor: isActiveLogPoint ? "#0ea5e9" : "#38bdf8",
          fillOpacity: isActiveLogPoint ? 1 : 0.85,
          weight: isActiveLogPoint ? 2 : 1,
          opacity: isActiveLogPoint ? 1 : 0.95,
        })
          .on("click", () => {
            preserveMapViewportRef.current = true;
            setActiveLogIndex(logIndex);
          })
          .bindTooltip(
            `<strong>Action:</strong> ${logPoint.action}<br/><strong>Waktu:</strong> ${formatDate(logPoint.actioned_at)}`,
            {
              direction: "top",
              offset: L.point(0, -8),
            },
          )
          .bindPopup(
            `<strong>${logPoint.assignment_id}</strong><br/>Action: ${logPoint.action}<br/>Lat: ${logPoint.latitude.toFixed(6)}<br/>Lon: ${logPoint.longitude.toFixed(6)}<br/>Waktu: ${formatDate(logPoint.actioned_at)}`,
          )
          .addTo(markerLayer);

        logPointLayers.push(logMarker);
      }

      if (logLatLngs.length > 1) {
        for (let i = 0; i < logLatLngs.length - 1; i++) {
          const from = logLatLngs[i] as [number, number];
          const to = logLatLngs[i + 1] as [number, number];

          const logSegmentLine = L.polyline([from, to], {
            color: "#0284c7",
            weight: 2,
            opacity: 0.9,
            dashArray: "8 8",
          }).addTo(markerLayer);
          logSegmentLayers.push(logSegmentLine);

          const angleDeg = getArrowAngleDeg(from, to);
          const midLat = (from[0] + to[0]) / 2;
          const midLon = (from[1] + to[1]) / 2;

          const logChevronMarker = L.marker([midLat, midLon], {
            icon: L.divIcon({
              className: "violation-log-arrow-icon",
              html: `<span class="violation-log-arrow-wrap" style="transform: rotate(${angleDeg}deg)"><span class="violation-log-arrow"></span></span>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            interactive: false,
            keyboard: false,
          })
            .setOpacity(0.3)
            .addTo(markerLayer);

          logChevronLayers.push({ segmentIndex: i, marker: logChevronMarker });
        }

        const hasManualActiveSegment =
          activeLogIndex !== null && logSegmentLayers.length > 0;
        const manualActiveSegmentIndex = hasManualActiveSegment
          ? Math.min(Math.max(activeLogIndex, 0), logSegmentLayers.length - 1)
          : null;

        let timelineHeadSegment = manualActiveSegmentIndex ?? 0;
        let timelineSegmentProgress = 0;

        const getForwardDistance = (
          fromIndex: number,
          toIndex: number,
          total: number,
        ) => (toIndex - fromIndex + total) % total;

        const animateViolationLogs = (timestamp: number) => {
          if (lastLogAnimationTimestamp === 0) {
            lastLogAnimationTimestamp = timestamp;
          }

          const elapsedMs = Math.max(0, timestamp - lastLogAnimationTimestamp);
          lastLogAnimationTimestamp = timestamp;

          logAnimationDashOffset -= elapsedMs * logDashShiftSpeedPerMs;
          logAnimationWavePhase += elapsedMs * logChevronWaveSpeedPerMs;

          if (logSegmentLayers.length > 0) {
            const fromLog = focusedTimelineLogs[timelineHeadSegment];
            const toLog =
              focusedTimelineLogs[
                Math.min(
                  timelineHeadSegment + 1,
                  focusedTimelineLogs.length - 1,
                )
              ];
            const timeGapMs = Math.max(
              700,
              Math.min(
                5000,
                new Date(toLog.actioned_at).getTime() -
                  new Date(fromLog.actioned_at).getTime(),
              ),
            );

            timelineSegmentProgress += elapsedMs / timeGapMs;
            while (
              timelineSegmentProgress >= 1 &&
              logSegmentLayers.length > 0
            ) {
              timelineSegmentProgress -= 1;
              timelineHeadSegment += 1;
              if (timelineHeadSegment >= logSegmentLayers.length) {
                timelineHeadSegment =
                  hasManualActiveSegment && manualActiveSegmentIndex !== null
                    ? manualActiveSegmentIndex
                    : 0;
              }
            }
          }

          logSegmentLayers.forEach((segmentLine, index) => {
            const isCurrent = index === timelineHeadSegment;
            const isReached =
              hasManualActiveSegment && manualActiveSegmentIndex !== null
                ? getForwardDistance(
                    manualActiveSegmentIndex,
                    index,
                    logSegmentLayers.length,
                  ) <
                  getForwardDistance(
                    manualActiveSegmentIndex,
                    timelineHeadSegment,
                    logSegmentLayers.length,
                  )
                : index < timelineHeadSegment;

            segmentLine.setStyle({
              dashOffset: `${logAnimationDashOffset}`,
              opacity: isCurrent ? 1 : isReached ? 0.35 : 0.12,
              weight: isCurrent ? 5 : 1.5,
              color: isCurrent ? "#0ea5e9" : "#0284c7",
              dashArray: isCurrent ? "12 7" : "7 11",
            });
          });

          logChevronLayers.forEach(({ segmentIndex, marker }) => {
            const isReached = segmentIndex < timelineHeadSegment;
            const isCurrent = segmentIndex === timelineHeadSegment;
            const wave =
              (Math.sin(logAnimationWavePhase - segmentIndex * 0.9) + 1) / 2;

            if (isCurrent) {
              marker.setOpacity(0.45 + wave * 0.55);
              return;
            }

            marker.setOpacity(
              isReached ? (hasManualActiveSegment ? 0.2 : 0.28) : 0.08,
            );
          });

          const highlightedPoint = hasManualActiveSegment
            ? Math.min(activeLogIndex ?? 0, logPointLayers.length - 1)
            : Math.min(timelineHeadSegment + 1, logPointLayers.length - 1);
          logPointLayers.forEach((pointLayer, index) => {
            const isHighlighted = index === highlightedPoint;
            const isPassed = index < highlightedPoint;

            pointLayer.setStyle({
              radius: isHighlighted ? 7 : 5,
              opacity: isHighlighted ? 1 : isPassed ? 0.85 : 0.45,
              fillOpacity: isHighlighted ? 1 : isPassed ? 0.72 : 0.35,
            });
          });

          logAnimationFrameId = requestAnimationFrame(animateViolationLogs);
        };

        logAnimationFrameId = requestAnimationFrame(animateViolationLogs);
      }
    }

    function stopPathAnimation() {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      animatedStartSegmentIndex = null;
      animationDashOffset = 0;
      animationHeadSegmentFloat = 0;
      lastAnimationTimestamp = 0;
      animationPauseUntilTimestamp = 0;
    }

    function stopViolationLogsAnimation() {
      if (logAnimationFrameId !== null) {
        cancelAnimationFrame(logAnimationFrameId);
        logAnimationFrameId = null;
      }
      logAnimationDashOffset = 0;
      logAnimationWavePhase = 0;
      lastLogAnimationTimestamp = 0;
    }

    function setSegmentDeltaTooltipVisibility(
      line: L.Polyline,
      isVisible: boolean,
    ) {
      const tooltip = line.getTooltip();
      if (!tooltip) {
        return;
      }

      const element = tooltip.getElement();
      if (!element) {
        return;
      }

      element.style.opacity = isVisible ? "1" : "0";
    }

    function applyDefaultStyles() {
      pointMarkers.forEach((pointMarker) => {
        pointMarker.setStyle({
          radius: 8,
          opacity: 1,
          fillOpacity: 0.75,
        });
      });

      segmentLayers.forEach(({ line }) => {
        line.setStyle({
          color: "#ef4444",
          weight: 2,
          opacity: 0.75,
          dashArray: undefined,
          dashOffset: undefined,
        });

        setSegmentDeltaTooltipVisibility(line, true);
      });

      arrowLayers.forEach(({ marker }) => {
        marker.setOpacity(1);
      });
    }

    function applyStaticPointFocusStyles(focusedPointIndex: number) {
      pointMarkers.forEach((pointMarker, index) => {
        const isFocusedPoint = focusedPointIndex === index;

        pointMarker.setStyle({
          radius: isFocusedPoint ? 10 : 8,
          opacity: isFocusedPoint ? 1 : 0.2,
          fillOpacity: isFocusedPoint ? 0.85 : 0.2,
        });
      });

      segmentLayers.forEach(({ line }) => {
        line.setStyle({
          color: "#fca5a5",
          weight: 2,
          opacity: 0,
          dashArray: undefined,
          dashOffset: undefined,
        });

        setSegmentDeltaTooltipVisibility(line, false);
      });

      arrowLayers.forEach(({ marker }) => {
        marker.setOpacity(0);
      });
    }

    function applyProgressiveFocusStyles(
      focusedPointIndex: number,
      currentSegmentIndex: number,
      dashOffset: number,
    ) {
      const reachedPointIndex = Math.min(
        currentSegmentIndex + 1,
        assignmentPoints.length - 1,
      );

      pointMarkers.forEach((pointMarker, index) => {
        const isFocusedPoint = focusedPointIndex === index;
        const isReachedPoint =
          index >= focusedPointIndex && index <= reachedPointIndex;
        const isActivePoint = isFocusedPoint || isReachedPoint;

        pointMarker.setStyle({
          radius: isFocusedPoint ? 10 : 8,
          opacity: isActivePoint ? 1 : 0.2,
          fillOpacity: isActivePoint ? 0.78 : 0.2,
        });
      });

      segmentLayers.forEach(({ from, line }) => {
        const isBeforeFocus = from < focusedPointIndex;
        const isReachedSegment =
          from >= focusedPointIndex && from < currentSegmentIndex;
        const isCurrentSegment = from === currentSegmentIndex;

        setSegmentDeltaTooltipVisibility(
          line,
          isReachedSegment || isCurrentSegment,
        );

        if (isReachedSegment) {
          line.setStyle({
            color: "#fca5a5",
            weight: 2,
            opacity: 0.2,
            dashArray: undefined,
            dashOffset: undefined,
          });
          return;
        }

        if (isCurrentSegment) {
          line.setStyle({
            color: "#ef4444",
            weight: 3,
            opacity: 1,
            dashArray: "10 8",
            dashOffset: `${dashOffset}`,
          });
          return;
        }

        line.setStyle({
          color: isBeforeFocus ? "#fca5a5" : "#fca5a5",
          weight: 2,
          opacity: 0,
          dashArray: undefined,
          dashOffset: undefined,
        });
      });

      arrowLayers.forEach(({ segmentIndex, marker }) => {
        const isCurrentArrow = segmentIndex === currentSegmentIndex;
        const isReachedArrow =
          segmentIndex >= focusedPointIndex &&
          segmentIndex < currentSegmentIndex;

        if (isCurrentArrow) {
          marker.setOpacity(1);
          return;
        }

        if (isReachedArrow) {
          marker.setOpacity(0.22);
          return;
        }

        marker.setOpacity(0);
      });
    }

    function startPathAnimation(startSegmentIndex: number) {
      if (startSegmentIndex >= segmentLayers.length) {
        stopPathAnimation();
        applyStaticPointFocusStyles(startSegmentIndex);
        return;
      }

      stopPathAnimation();
      animatedStartSegmentIndex = startSegmentIndex;
      animationHeadSegmentFloat = startSegmentIndex;
      lastAnimationTimestamp = 0;
      animationPauseUntilTimestamp = 0;

      const tick = (timestamp: number) => {
        if (animatedStartSegmentIndex === null) {
          return;
        }

        if (lastAnimationTimestamp === 0) {
          lastAnimationTimestamp = timestamp;
        }

        const elapsedMs = Math.max(0, timestamp - lastAnimationTimestamp);
        lastAnimationTimestamp = timestamp;

        if (animationPauseUntilTimestamp > timestamp) {
          animationFrameId = requestAnimationFrame(tick);
          return;
        }

        animationHeadSegmentFloat += elapsedMs * headAdvanceSpeedPerMs;
        if (animationHeadSegmentFloat > segmentLayers.length - 0.001) {
          animationHeadSegmentFloat = animatedStartSegmentIndex;
          animationPauseUntilTimestamp = timestamp + loopPauseMs;
        }

        const currentSegmentIndex = Math.min(
          Math.max(
            Math.floor(animationHeadSegmentFloat),
            animatedStartSegmentIndex,
          ),
          segmentLayers.length - 1,
        );

        animationDashOffset -= elapsedMs * dashShiftSpeedPerMs;
        applyProgressiveFocusStyles(
          animatedStartSegmentIndex,
          currentSegmentIndex,
          animationDashOffset,
        );

        animationFrameId = requestAnimationFrame(tick);
      };

      animationFrameId = requestAnimationFrame(tick);
    }

    function applyPointFocus(focusedPointIndex: number | null) {
      if (focusedPointIndex === null) {
        stopPathAnimation();
        applyDefaultStyles();
        return;
      }

      startPathAnimation(focusedPointIndex);
    }

    pointMarkers.forEach((pointMarker, index) => {
      pointMarker.on("mouseover", () => {
        applyPointFocus(index);
      });

      pointMarker.on("mouseout", () => {
        applyPointFocus(null);
      });
    });

    const boundsCollection: L.LatLngBounds[] = [];
    if (latLngs.length > 0) {
      boundsCollection.push(L.latLngBounds(latLngs));
    }
    if (timelineLatLngsForBounds.length > 0) {
      boundsCollection.push(L.latLngBounds(timelineLatLngsForBounds));
    }
    if (boundaryLayerRef.current) {
      const boundaryBounds = boundaryLayerRef.current.getBounds();
      if (boundaryBounds.isValid()) {
        boundsCollection.push(boundaryBounds);
      }
    }

    const shouldPreserveViewport = preserveMapViewportRef.current;
    preserveMapViewportRef.current = false;

    if (!shouldPreserveViewport) {
      if (boundsCollection.length > 0) {
        const mergedBounds = boundsCollection[0];
        for (let i = 1; i < boundsCollection.length; i++) {
          mergedBounds.extend(boundsCollection[i]);
        }

        map.fitBounds(mergedBounds, {
          padding: [10, 10],
          maxZoom: fitBoundsMaxZoom,
        });
      } else if (assignmentPoints.length > 0) {
        map.setView(mapCenter, singlePointZoom);
      }
    }

    return () => {
      stopPathAnimation();
      stopViolationLogsAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeLogIndex,
    assignmentPoints,
    focusedTimelineLogs,
    mapCenter,
    parsedAppliedDeltaMaxMinutes,
    regionBoundaryFeature,
  ]);

  useEffect(() => {
    return () => {
      if (violationRadiusLayerRef.current) {
        violationRadiusLayerRef.current.remove();
        violationRadiusLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!surveyPeriodId || !regionFullCode) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [surveyResult, assignmentResult, regionResult] =
          await Promise.all([
            fetchSurveyByPeriodId(surveyPeriodId),
            fetchAssignmentsBySurveyPeriodId(surveyPeriodId, {
              key: "region_full_code",
              value: regionFullCode,
            }),
            fetchSurveyRegions(surveyPeriodId, {
              region_full_code: regionFullCode,
            }),
          ]);
        const selectedRegion = regionResult[0] || null;

        const geoJsonKey = surveyResult.geojson_key || "idsubsls";
        const areaGeoJSONPath = surveyResult.area?.geojson_file_path?.trim() || "";
        let boundaryFeature: GeoJsonFeature | null = null;
        if (areaGeoJSONPath !== "") {
          const geoJsonUrl = `${backendOrigin}/static${areaGeoJSONPath.startsWith("/") ? areaGeoJSONPath : `/${areaGeoJSONPath}`}`;
          boundaryFeature = await fetchGeoJsonFeatureByKey(
            regionFullCode,
            geoJsonKey,
            geoJsonUrl,
          );
        }

        setSurvey(surveyResult);
        setAssignments(assignmentResult);
        setRegion(selectedRegion);
        setRegionBoundaryFeature(boundaryFeature);

        const configuredDateFrom =
          normalizeDateInputValue(surveyResult.log_date_from) ||
          defaultDateFrom;
        const configuredDateTo =
          normalizeDateInputValue(surveyResult.log_date_to) || defaultDateTo;
        const configuredDelta = surveyResult.log_delta_max_minutes
          ? String(surveyResult.log_delta_max_minutes)
          : "30";

        setLogsDateFrom(configuredDateFrom);
        setLogsDateTo(configuredDateTo);
        setAppliedLogsDateFrom(configuredDateFrom);
        setAppliedLogsDateTo(configuredDateTo);
        setDeltaMaxMinutes(configuredDelta);
        setAppliedDeltaMaxMinutes(configuredDelta);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal memuat detail region";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [backendOrigin, defaultDateFrom, defaultDateTo, regionFullCode, surveyPeriodId]);

  useEffect(() => {
    if (!surveyPeriodId || !regionFullCode || !hasAppliedLogsFilter) {
      setLogsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRegionLogs() {
      setLogsLoading(true);
      setLogsError(null);

      try {
        const logs = await fetchSurveyRegionLogs(surveyPeriodId, {
          region_full_code: regionFullCode,
          actioned_at_from: appliedLogsDateFrom || undefined,
          actioned_at_to: appliedLogsDateTo || undefined,
        });

        if (!cancelled) {
          setRegionLogs(logs);
          setActiveLogIndex(logs.length > 0 ? 0 : null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Gagal memuat jejak logs petugas";
          setLogsError(message);
          setRegionLogs([]);
          setActiveLogIndex(null);
        }
      } finally {
        if (!cancelled) {
          setLogsLoading(false);
        }
      }
    }

    void loadRegionLogs();

    return () => {
      cancelled = true;
    };
  }, [
    appliedLogsDateFrom,
    appliedLogsDateTo,
    hasAppliedLogsFilter,
    regionFullCode,
    surveyPeriodId,
  ]);

  useEffect(() => {
    if (focusedTimelineLogs.length === 0) {
      setActiveLogIndex(null);
      return;
    }

    if (
      activeLogIndex === null ||
      activeLogIndex < 0 ||
      activeLogIndex >= focusedTimelineLogs.length
    ) {
      setActiveLogIndex(0);
    }
  }, [activeLogIndex, focusedTimelineLogs]);

  function applyLogsDateFilter() {
    if (
      logsDateFrom &&
      logsDateTo &&
      new Date(logsDateFrom).getTime() > new Date(logsDateTo).getTime()
    ) {
      setLogsError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
      return;
    }

    setLogsError(null);
    setHasAppliedLogsFilter(true);
    setIsTimelineVisible(true);
    setSelectedLogsAssignmentId(null);
    setAppliedLogsDateFrom(logsDateFrom);
    setAppliedLogsDateTo(logsDateTo);
    preserveMapViewportRef.current = false;
  }

  function closeLogsActivity() {
    setIsTimelineVisible(false);
    setHasAppliedLogsFilter(false);
    setRegionLogs([]);
    setActiveLogIndex(null);
    setSelectedLogsAssignmentId(null);
  }

  function focusTimelineLog(index: number) {
    if (index < 0 || index >= focusedTimelineLogs.length) {
      return;
    }

    const logPoint = focusedTimelineLogs[index];
    setIsTimelineVisible(true);
    setActiveLogIndex(index);
    preserveMapViewportRef.current = true;

    if (mapRef.current) {
      const currentPoint: [number, number] = [
        logPoint.latitude,
        logPoint.longitude,
      ];
      const nextLogPoint = focusedTimelineLogs[index + 1] || null;
      const prevLogPoint = focusedTimelineLogs[index - 1] || null;

      const adjacentPoint: [number, number] | null = nextLogPoint
        ? [nextLogPoint.latitude, nextLogPoint.longitude]
        : prevLogPoint
          ? [prevLogPoint.latitude, prevLogPoint.longitude]
          : null;

      if (adjacentPoint) {
        const focusBounds = L.latLngBounds([currentPoint, adjacentPoint]);
        mapRef.current.fitBounds(focusBounds, {
          padding: [56, 56],
          maxZoom: 20,
          animate: true,
        });
      } else {
        mapRef.current.setView(
          currentPoint,
          Math.max(mapRef.current.getZoom(), 20),
          {
            animate: true,
          },
        );
      }
    }
  }

  function focusLogsByAssignment(
    assignmentId: string,
    options?: { resetFromStart?: boolean },
  ) {
    preserveMapViewportRef.current = true;
    setIsTimelineVisible(true);
    setSelectedLogsAssignmentId(assignmentId);
    setLogsError(null);

    if (options?.resetFromStart) {
      setActiveLogIndex(0);
    }

    if (!hasAppliedLogsFilter) {
      setHasAppliedLogsFilter(true);
      setAppliedLogsDateFrom(logsDateFrom);
      setAppliedLogsDateTo(logsDateTo);
    }
  }

  function updateViolationRadiusLayer(
    assignmentId: string,
    centers: CoordinatePoint[],
  ) {
    if (violationRadiusLayerRef.current) {
      violationRadiusLayerRef.current.remove();
      violationRadiusLayerRef.current = null;
    }

    if (centers.length === 0 || !mapRef.current) {
      return;
    }

    const layerGroup = L.layerGroup().addTo(mapRef.current);
    centers.forEach((center, index) => {
      const proportionText = `${(center.proportion * 100).toFixed(2)}%`;
      L.circle([center.lat, center.lon], {
        radius: 100,
        color: "#f59e0b",
        weight: 2,
        opacity: 0.9,
        fillColor: "#fcd34d",
        fillOpacity: 0.14,
      })
        .on("click", () => {
          focusLogsByAssignment(assignmentId, { resetFromStart: true });
        })
        .bindPopup(
          `<strong>Radius Lokasi ${index + 1}</strong><br/>Proporsi Score: ${proportionText}`,
          { autoPan: false },
        )
        .addTo(layerGroup);
    });

    violationRadiusLayerRef.current = layerGroup;
  }

  function updateViolationRadiusByAssignment(assignmentId: string) {
    focusLogsByAssignment(assignmentId, { resetFromStart: true });
    const centers = violationCentersByAssignment[assignmentId] || [];
    updateViolationRadiusLayer(assignmentId, centers);

    if (centers.length === 0) {
      setSelectedViolationRadiusDetail(null);
      return;
    }

    setSelectedViolationRadiusDetail({
      assignmentId,
      locations: centers,
    });
  }

  const selectedPointFasihUrl = selectedPointDetail
    ? `https://fasih-sm.bps.go.id/app/assignment/${encodeURIComponent(survey?.survey_period_id || surveyPeriodId)}/${encodeURIComponent(selectedPointDetail.assignmentId)}`
    : "";

  return (
    <main className="relative h-screen w-full overflow-hidden">
      {!loading &&
      !error &&
      (assignmentPoints.length > 0 ||
        timelineLogs.length > 0 ||
        regionBoundaryFeature) ? (
        <div
          ref={mapWrapRef}
          className="map-wrap h-screen w-full rounded-none border-0"
        >
          <div
            ref={mapContainerRef}
            className="assignment-map assignment-map-full"
          />

          <div className="pointer-events-none absolute top-3 left-3 right-3 z-700 grid gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 bg-background/95 px-3 backdrop-blur-xs"
              >
                <Link to={`/surveys/${surveyPeriodId}`}>Kembali</Link>
              </Button>
              <Badge variant="outline" className="h-8 bg-background/95 px-3">
                {region?.full_code || regionFullCode || "Region"}
              </Badge>
              <Badge variant="outline" className="h-8 bg-background/95 px-3">
                Assignment: {assignments.length}
              </Badge>
              <Badge variant="outline" className="h-8 bg-background/95 px-3">
                Logs:{" "}
                {selectedLogsAssignmentId
                  ? `${focusedTimelineLogs.length}/${timelineLogs.length}`
                  : timelineLogs.length}
              </Badge>
              <div className="map-delta-inline bg-background/95">
                <span>Δ max</span>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={deltaMaxMinutes}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDeltaMaxMinutes(value);
                    setAppliedDeltaMaxMinutes(value);
                  }}
                  className="map-delta-input h-8 w-20"
                />
                <span>menit</span>
              </div>
              <div className="map-log-filter-panel map-log-filter-panel-inline">
                <div className="map-log-filter-grid map-log-filter-grid-inline">
                  <Input
                    type="date"
                    value={logsDateFrom}
                    onChange={(event) => {
                      setLogsDateFrom(event.target.value);
                    }}
                    className="h-8 w-28 map-date-input map-date-input-left"
                  />
                  <span className="map-date-separator">-</span>
                  <Input
                    type="date"
                    value={logsDateTo}
                    onChange={(event) => {
                      setLogsDateTo(event.target.value);
                    }}
                    className="h-8 w-28 map-date-input map-date-input-right"
                  />
                </div>
                <div className="map-log-filter-actions map-log-filter-actions-inline">
                  <Button
                    size="sm"
                    onClick={applyLogsDateFilter}
                    className="h-8 w-8 px-0"
                    title="Lihat Jejak"
                    aria-label="Lihat Jejak"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto pathway-legend absolute bottom-3 left-3 z-700 w-fit max-w-[calc(100%-1.5rem)] rounded-none border border-border bg-card/95 p-2 text-xs backdrop-blur-xs">
            <span className="legend-item">
              <i className="legend-dot legend-inside" /> Di dalam area
            </span>
            <span className="legend-item">
              <i className="legend-dot legend-outside" /> Di luar area
            </span>
            <span className="legend-item">
              <i className="legend-dot legend-violation" /> Titik Violation
            </span>
            <span className="legend-item">
              <i className="legend-dot legend-log-point" /> Titik Logs Violation
            </span>
            <span className="legend-item">
              <i className="legend-log-line" /> Jejak Petugas (Timeline)
            </span>
            <span className="legend-item">
              <i className="legend-label-badge">A</i> Label Titik Awal
            </span>
            <span className="legend-item">
              <i className="legend-label-badge">K</i> Label Titik Akhir
            </span>
            <span className="legend-item">
              <i className="legend-line" /> Jalur Pathway
            </span>
            <span className="legend-item">
              <i className="legend-arrow" /> Arah Pathway
            </span>
          </div>

          {isTimelineVisible && (
            <aside className="map-logs-timeline-panel border border-border bg-card/95 shadow-sm backdrop-blur-xs">
              <div className="map-logs-timeline-head">
                <strong>Aktivitas Petugas</strong>
                <div className="map-logs-timeline-head-actions">
                  <span>{focusedTimelineLogs.length} titik</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 px-2 text-[10px]"
                    onClick={closeLogsActivity}
                  >
                    Tutup
                  </Button>
                </div>
              </div>
              <p className="map-logs-timeline-meta">
                Periode: {appliedLogsDateFrom || "-"} s/d{" "}
                {appliedLogsDateTo || "-"}
              </p>

              {logsLoading && (
                <p className="map-logs-timeline-state">Memuat logs...</p>
              )}
              {!logsLoading && logsError && (
                <p className="map-logs-timeline-state map-logs-timeline-state-error">
                  {logsError}
                </p>
              )}
              {selectedLogsAssignmentId && (
                <p className="map-logs-timeline-meta">
                  Fokus Assignment: {selectedLogsAssignmentId}
                </p>
              )}

              {!logsLoading &&
                !logsError &&
                focusedTimelineLogs.length === 0 && (
                  <p className="map-logs-timeline-state">
                    Tidak ada logs pada rentang tanggal ini.
                  </p>
                )}

              {!logsLoading && !logsError && focusedTimelineLogs.length > 0 && (
                <div className="map-logs-timeline-list">
                  {focusedTimelineLogs.map((logPoint, index) => {
                    const isActive = index === activeLogIndex;
                    return (
                      <button
                        key={logPoint.id}
                        type="button"
                        className={`map-logs-item ${isActive ? "is-active" : ""}`}
                        onClick={() => {
                          focusTimelineLog(index);
                        }}
                      >
                        <div className="map-logs-item-head">
                          <strong>{logPoint.action}</strong>
                          <span>{index + 1}</span>
                        </div>
                        <p>{formatDate(logPoint.actioned_at)}</p>
                        <p>Assignment: {logPoint.assignment_id}</p>
                        <p>
                          Lat {logPoint.latitude.toFixed(6)} • Lon{" "}
                          {logPoint.longitude.toFixed(6)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>
          )}

          {selectedPointDetail && (
            <aside className="map-point-detail-panel border border-border bg-card/95 shadow-sm backdrop-blur-xs">
              <div className="map-point-detail-head">
                <strong>{selectedPointDetail.assignmentId}</strong>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="map-point-detail-close"
                  onClick={() => {
                    setSelectedPointDetail(null);
                    setSelectedViolationRadiusDetail(null);
                    updateViolationRadiusLayer(
                      selectedPointDetail.assignmentId,
                      [],
                    );
                  }}
                >
                  Tutup
                </Button>
              </div>
              <p>
                Urutan {selectedPointDetail.sequence} •{" "}
                {selectedPointDetail.pointTypeLabel}
              </p>
              <p>Zona: {selectedPointDetail.zoneLabel}</p>
              <p>
                Lat: {selectedPointDetail.lat.toFixed(6)} • Lon:{" "}
                {selectedPointDetail.lon.toFixed(6)}
              </p>
              <p>
                Waktu ({selectedPointDetail.pathwaySource}):{" "}
                {formatDate(selectedPointDetail.pathwayAt)}
              </p>
              <p>
                Violation:{" "}
                {selectedPointDetail.isViolation
                  ? `Ya (${(selectedPointDetail.violationScore * 100).toFixed(2)}%)`
                  : "Tidak"}
              </p>
              {selectedViolationRadiusDetail &&
                selectedViolationRadiusDetail.assignmentId ===
                  selectedPointDetail.assignmentId && (
                  <div>
                    <p>Proporsi Score (Radius Lokasi):</p>
                    {selectedViolationRadiusDetail.locations.map(
                      (location, index) => (
                        <p
                          key={`${selectedPointDetail.assignmentId}-radius-${index}`}
                        >
                          {index + 1}. {(location.proportion * 100).toFixed(2)}%
                        </p>
                      ),
                    )}
                  </div>
                )}
              <Button asChild className="map-point-detail-link" size="sm">
                <a
                  href={selectedPointFasihUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka di Fasih
                </a>
              </Button>
            </aside>
          )}
        </div>
      ) : (
        <div className="flex h-screen items-start justify-center p-4 md:p-6">
          <div className="w-full max-w-3xl space-y-3">
            <Button asChild variant="outline" size="sm">
              <Link to={`/surveys/${surveyPeriodId}`}>Kembali</Link>
            </Button>
            {error && (
              <Card className="border-rose-200 bg-rose-50">
                <CardContent className="py-3 text-xs text-rose-700">
                  {error}
                </CardContent>
              </Card>
            )}
            {loading && !error && (
              <Card>
                <CardContent className="py-3 text-xs">
                  Sedang memuat data map assignment region...
                </CardContent>
              </Card>
            )}
            {!loading &&
              !error &&
              assignmentPoints.length === 0 &&
              timelineLogs.length === 0 &&
              !regionBoundaryFeature && (
                <Card>
                  <CardContent className="py-3 text-xs">
                    Koordinat assignment dan boundary GeoJSON belum tersedia
                    untuk region ini.
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      )}
    </main>
  );
};

export default SurveyRegionDetailPage;
