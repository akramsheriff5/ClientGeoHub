import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  Collapse,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 14);
    }
  }, [position, map]);
  return null;
}

export default function EnhancedMapWithSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedName, setSelectedName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiProvider, setApiProvider] = useState('nominatim');
  const [showSettings, setShowSettings] = useState(false);
  
  const abortControllerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 500); // 500ms debounce

  // API configurations
  const apis = {
    nominatim: {
      name: 'Nominatim (Free)',
      search: async (query) => {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&addressdetails=1&limit=5`,
          {
            headers: {
              'User-Agent': 'MapSearchApp/1.0'
            }
          }
        );
        const data = await response.json();
        return data.map(item => ({
          id: item.place_id,
          display_name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type
        }));
      }
    },
    photon: {
      name: 'Photon (Free, Faster)',
      search: async (query) => {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await response.json();
        return data.features.map(item => ({
          id: item.properties.osm_id,
          display_name: item.properties.name + (item.properties.city ? `, ${item.properties.city}` : '') + (item.properties.country ? `, ${item.properties.country}` : ''),
          lat: item.geometry.coordinates[1],
          lon: item.geometry.coordinates[0],
          type: item.properties.type
        }));
      }
    }
  };

  const searchLocations = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError('');

    try {
      const results = await apis[apiProvider].search(searchQuery);
      
      if (results.length > 0) {
        setSuggestions(results);
      } else {
        setSuggestions([]);
        setError('No results found');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Search failed. Please try again.');
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiProvider]);

  // Effect for debounced search
  useEffect(() => {
    searchLocations(debouncedQuery);
  }, [debouncedQuery, searchLocations]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setError('');
    
    if (value.length >= 3) {
      setIsExpanded(true);
    }
  };

  const handleSelect = (place) => {
    const { lat, lon, display_name } = place;
    setSelectedPosition([lat, lon]);
    setSelectedName(display_name);
    setQuery(display_name);
    setSuggestions([]);
    setIsExpanded(false);
    setError('');
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setSelectedPosition(null);
    setSelectedName('');
    setIsExpanded(false);
    setError('');
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Box sx={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Search UI */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
          width: 350,
        }}
      >
        <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {/* Main Search Bar */}
          <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon color="action" />
            <TextField
              fullWidth
              placeholder="Search locations..."
              variant="standard"
              value={query}
              onChange={handleInputChange}
              InputProps={{
                disableUnderline: true,
                endAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isLoading && <CircularProgress size={16} />}
                    {query && (
                      <IconButton size="small" onClick={handleClear}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={toggleExpand}>
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                )
              }}
            />
          </Box>

          {/* Settings Panel */}
          <Collapse in={showSettings}>
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Search Provider</InputLabel>
                <Select
                  value={apiProvider}
                  label="Search Provider"
                  onChange={(e) => setApiProvider(e.target.value)}
                >
                  {Object.entries(apis).map(([key, api]) => (
                    <MenuItem key={key} value={key}>
                      {api.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Photon is generally faster than Nominatim
              </Typography>
            </Box>
          </Collapse>

          {/* Current Selection */}
          {selectedName && (
            <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Chip
                icon={<LocationIcon />}
                label={selectedName.length > 40 ? selectedName.substring(0, 40) + '...' : selectedName}
                variant="outlined"
                size="small"
                onDelete={handleClear}
                sx={{ maxWidth: '100%' }}
              />
            </Box>
          )}

          {/* Search Results */}
          <Collapse in={isExpanded && (suggestions.length > 0 || error)}>
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {error && (
                <Alert severity="warning" sx={{ m: 1 }}>
                  {error}
                </Alert>
              )}
              
              {suggestions.length > 0 && (
                <List dense disablePadding>
                  {suggestions.map((place, i) => (
                    <ListItem
                      key={place.id || i}
                      onClick={() => handleSelect(place)}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                        borderBottom: i < suggestions.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider'
                      }}
                    >
                      <LocationIcon 
                        sx={{ mr: 1, color: 'action.active', fontSize: 18 }} 
                      />
                      <ListItemText
                        primary={
                          <Typography variant="body2" noWrap>
                            {place.display_name}
                          </Typography>
                        }
                        secondary={
                          place.type && (
                            <Chip 
                              label={place.type} 
                              size="small" 
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Collapse>
        </Paper>

        {/* Search Stats */}
        {suggestions.length > 0 && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}
          >
            {suggestions.length} results • {apis[apiProvider].name}
          </Typography>
        )}
      </Box>

      {/* Map Display */}
      <MapContainer
        center={[20.5937, 78.9629]} // India center
        zoom={5}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {selectedPosition && (
          <>
            <Marker position={selectedPosition}>
              <Popup>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    📍 Selected Location
                  </Typography>
                  <Typography variant="body2">
                    {selectedName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}
                  </Typography>
                </Box>
              </Popup>
            </Marker>
            <MapUpdater position={selectedPosition} />
          </>
        )}
      </MapContainer>
    </Box>
  );
}