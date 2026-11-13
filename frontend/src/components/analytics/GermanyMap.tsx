import React, { useMemo, useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { JobApplication, ApplicationStatus } from '../../types';
import 'leaflet/dist/leaflet.css';
import { PALETTE as P, stageHex } from '../../utils/statusStyle';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GermanyMapProps {
  applications: JobApplication[];
}

interface LocationData {
  name: string;
  coordinates: [number, number];
  applications: JobApplication[];
  count: number;
  geocoded: boolean;
}

// Cache for geocoding results
const geocodeCache: Map<string, [number, number]> = new Map();

// Geocode a city name to coordinates
const geocodeLocation = async (location: string): Promise<[number, number] | null> => {
  // Check cache first
  const cacheKey = location.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    // Use Nominatim (OpenStreetMap) geocoding service - free and no API key needed
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)},Germany&limit=1&countrycodes=de`
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];

      // Cache the result
      geocodeCache.set(cacheKey, coords);

      // Also cache in localStorage for persistence
      try {
        localStorage.setItem(`geocode_${cacheKey}`, JSON.stringify(coords));
      } catch (e) {
        // localStorage might not be available
      }

      return coords;
    }
  } catch (error) {
    console.warn(`Failed to geocode location: ${location}`, error);
  }

  // Try to load from localStorage if fetch failed
  try {
    const cached = localStorage.getItem(`geocode_${cacheKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // localStorage might not be available
  }

  return null;
};

// Load cached coordinates on component mount
const loadCachedCoordinates = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('geocode_')) {
        const value = localStorage.getItem(key);
        if (value) {
          const coords = JSON.parse(value);
          geocodeCache.set(key.replace('geocode_', ''), coords);
        }
      }
    }
  } catch (e) {
    // localStorage might not be available
  }
};

// Custom marker component with status-based colors
const StatusMarker: React.FC<{
  position: [number, number];
  location: LocationData;
}> = ({ position, location }) => {
  // Get status color based on most common status
  const getStatusColor = (applications: JobApplication[]) => {
    const statusCounts = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<ApplicationStatus, number>);

    const topStatus = Object.entries(statusCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as ApplicationStatus;

    // The marker takes the colour of the most common stage there.
    return stageHex(topStatus ?? 'Applied');
  };

  const color = getStatusColor(location.applications);

  // Create custom icon
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        border: 2px solid ${P.ground};
        border-radius: 50%;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${P.ground};
        font-family: 'Plex Mono', ui-monospace, monospace;
        font-weight: 500;
        font-size: 12px;
        cursor: pointer;
      ">
        ${location.count}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <Marker position={position} icon={customIcon}>
      <Popup>
        <div className="p-2 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-arc" />
            <h3 className="font-semibold text-ink">{location.name}</h3>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-dim">Total applications:</span>
              <span className="font-medium">{location.count}</span>
            </div>

            {/* Status breakdown */}
            {Object.entries(
              location.applications.reduce((acc, app) => {
                acc[app.status] = (acc[app.status] || 0) + 1;
                return acc;
              }, {} as Record<ApplicationStatus, number>)
            ).map(([status, count]) => (
              <div key={status} className="flex justify-between text-xs">
                <span className="text-ink-dim">{status}:</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

const GermanyMap: React.FC<GermanyMapProps> = ({ applications }) => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load cached coordinates on mount
  useEffect(() => {
    loadCachedCoordinates();
  }, []);

  // Process applications and geocode locations
  useEffect(() => {
    const processLocations = async () => {
      setLoading(true);

      // Group applications by location
      const locationGroups = applications.reduce((acc, app) => {
        const location = app.location.trim();
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(app);
        return acc;
      }, {} as Record<string, JobApplication[]>);

      // Geocode each location
      const locationPromises = Object.entries(locationGroups).map(async ([locationName, apps]) => {
        const coordinates = await geocodeLocation(locationName);

        if (coordinates) {
          return {
            name: locationName,
            coordinates,
            applications: apps,
            count: apps.length,
            geocoded: true
          } as LocationData;
        }

        return null;
      });

      const geocodedLocations = (await Promise.all(locationPromises)).filter(
        (location): location is LocationData => location !== null
      );

      setLocations(geocodedLocations);
      setLoading(false);
    };

    if (applications.length > 0) {
      processLocations();
    } else {
      setLocations([]);
      setLoading(false);
    }
  }, [applications]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCities = locations.length;
    const totalApplications = locations.reduce((sum, loc) => sum + loc.count, 0);
    const citiesWithOffers = locations.filter(loc =>
      loc.applications.some(app => app.status === 'Offer')
    ).length;
    const mostActiveCity = locations.reduce((max, loc) =>
      loc.count > max.count ? loc : max,
      locations[0] || { name: 'N/A', count: 0 }
    );

    return {
      totalCities,
      totalApplications,
      citiesWithOffers,
      mostActiveCity: mostActiveCity?.name || 'N/A'
    };
  }, [locations]);

  // Germany center coordinates
  const germanyCenter: [number, number] = [51.1657, 10.4515];

  if (loading) {
    return (
      <div className="instrument">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="label">Germany Applications Map</h2>
        </div>

        {/* Loading: the map's shape in slate, no spinner. */}
        <div className="h-96 placeholder flex items-end p-3">
          <p className="stamp uppercase">Placing locations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="instrument">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="label">Germany Applications Map</h2>
      </div>

      {/* Map Container */}
      {/* OpenStreetMap's own tiles, darkened by a filter on the tile pane only
          (index.css, .map-dark) so no new tile host sees the traffic. */}
      <div className="h-96 overflow-hidden border-2 border-engrave map-dark">
        <MapContainer
          center={germanyCenter}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {locations.map((location) => (
            <StatusMarker
              key={location.name}
              position={location.coordinates}
              location={location}
            />
          ))}
        </MapContainer>
      </div>

      {/* Legend: the stages, as everywhere else in the app. */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 stamp uppercase">
        {[['Applied', 'Sent'], ['Replied', 'In conversation'], ['Offer', 'Offer'], ['Rejected', 'Ended']].map(([s, word]) => (
          <span key={s} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-circle" style={{ backgroundColor: stageHex(s) }} />{word}</span>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-engrave">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-arc">{stats.totalCities}</div>
            <div className="stamp">Cities with Applications</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-arc">{stats.totalApplications}</div>
            <div className="stamp">Total Applications</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-arc">{stats.citiesWithOffers}</div>
            <div className="stamp">Cities with Offers</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{stats.mostActiveCity}</div>
            <div className="stamp">Most Active City</div>
          </div>
        </div>
      </div>

      {/* Info about geocoding */}
      <p className="mt-4 stamp">Locations are geocoded with OpenStreetMap's free service and cached locally.</p>
    </div>
  );
};

export default GermanyMap;