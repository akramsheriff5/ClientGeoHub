import { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Button, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  MenuItem, 
  Select, 
  InputLabel, 
  FormControl, 
  Box, 
  Typography, 
  Chip, 
  Card, 
  CardContent,
  Paper,
  List,
  ListItem,
  ListItemText,
  Collapse,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  LocationOn as LocationOnIcon,
  Group as GroupIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  // Tooltip
} from '@mui/icons-material';
import L from 'leaflet';

import LoginPage from './components/login';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

import MapLoading from './components/loading'

const PRIMARY_BG = '#0e1230';
const ACCENT = '#63a8cd';
const FONT_DARK = '#1F1F1F';
const FONT_LIGHT = '#fff';

const STAGE_COLORS = {
  Pipeline: { bg: '#fdecea', text: '#e74c3c' },
  'In Proposal': { bg: '#fff8e1', text: '#b7950b' },
  'POC Stage': { bg: '#e3f2fd', text: '#2471a3' },
  'Current Client': { bg: '#e8f5e9', text: '#229954' },
};

const DEFAULT_STAGE = 'Pipeline';
const STAGES = Object.keys(STAGE_COLORS);
const FOCUS_ZOOM = 13;
const SIDEBAR_WIDTH = 350;

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

function AddMarker({ onAdd }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng);
    },
  });
  return null;
}


import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // prevent flicker on refresh

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false); // done checking
    });

    return () => unsubscribe(); // cleanup listener on unmount
  }, []);

  if (loading) return <MapLoading text="Fetching location data..." variant="globe" />

  return user ? (
    <SimpleMapWithSearch user={user} />
  ) : (
    <LoginPage onLogin={() => setUser(auth.currentUser)} />
  );
}

export default App;


function EnhancedLocationSearch({ mapRef }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedName, setSelectedName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiProvider, setApiProvider] = useState('photon');
  const [showSettings, setShowSettings] = useState(false);
  
  const abortControllerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 500);

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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
    const position = [lat, lon];
    setSelectedPosition(position);
    setSelectedName(display_name);
    setQuery(display_name);
    setSuggestions([]);
    setIsExpanded(false);
    setError('');

    // Navigate to the selected location
    if (mapRef.current) {
      mapRef.current.setView(position, 14, { animate: true });
    }
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
    <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, width: 350 }}>
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
              icon={<LocationOnIcon />}
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
                    <LocationOnIcon 
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
  );
}

function DashboardHeader({ clientCount, onLogout }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 4, py: 2, bgcolor: '#fff', borderBottom: '1px solid #e5e7eb', boxShadow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ bgcolor: '#4285f4', color: '#fff', borderRadius: 2, p: 1, mr: 2, boxShadow: 1, display: 'flex', alignItems: 'center', fontSize: 32 }}>
          <LocationOnIcon sx={{ fontSize: 24, mr: 0.5 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: '#222', lineHeight: 1 }}>Client Geo Hub</Typography>
          <Typography variant="subtitle2" sx={{ color: '#666', fontSize: 15 }}>Manage your global client network</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="outlined" sx={{ borderColor: '#e5e7eb', color: '#222', fontWeight: 500, bgcolor: '#fff', '&:hover': { bgcolor: '#f5f6fa' } }} onClick={onLogout}>Logout</Button>
      </Box>
    </Box>
  );
}

// function Sidebar({ markers, onSelect, onAddClick, onEdit, onDelete, search, setSearch }) {
//   return (
//     <Card sx={{ width: 420, borderRadius: 3, boxShadow: 3, p: 3, height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', minWidth: 320 }}>
//       <Typography variant="h6" sx={{ mb: 2, color: '#222', fontWeight: 700 }}>Clients</Typography>
//       <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
//         <TextField
//           placeholder="Search clients..."
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//           variant="outlined"
//           size="small"
//           sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 1 }}
//           InputProps={{ style: { color: FONT_DARK } }}
//         />
//         {/* <GroupIcon sx={{ color: '#4285f4', fontSize: 22, mr: 0.5 }} />
//         <Typography sx={{ color: '#222', fontWeight: 500, mr: 2 }}>{markers.length} Clients</Typography> */}

//         {/* <Button variant="contained" startIcon={<AddIcon />} sx={{ bgcolor: '#4285f4', color: '#fff', fontWeight: 600, borderRadius: 2, boxShadow: 'none', '&:hover': { bgcolor: '#357ae8' } }} onClick={onAddClick}>Add Client</Button> */}
//       </Box>

//       <Box sx={{ flex: 1, overflow: 'auto' }}>
//         <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
//           <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
//             <tr>
//               <th style={{ textAlign: 'left', fontWeight: 600, color: '#222', fontSize: 15, padding: '8px' }}>Name</th>
//               <th style={{ textAlign: 'left', fontWeight: 600, color: '#222', fontSize: 15, padding: '8px' }}>Location</th>
//               <th style={{ textAlign: 'left', fontWeight: 600, color: '#222', fontSize: 15, padding: '8px' }}>Stage</th>
//               <th style={{ textAlign: 'left', fontWeight: 600, color: '#222', fontSize: 15, padding: '8px' }}>Edit</th>
//               <th style={{ width: 40 }}></th>
//             </tr>
//           </thead>
//           <tbody>
//             {markers.length === 0 && (
//               <tr><td colSpan={4} style={{ color: '#888', padding: '12px' }}>No clients found</td></tr>
//             )}
//             {markers.map((marker, idx) => (
//               <tr key={idx} style={{ cursor: 'pointer', backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }} onClick={() => onSelect(marker)}>
//                 <td style={{ padding: '8px', color: '#222', fontWeight: 600 }}>
//                   {marker.site_name}
//                   <Typography variant="body2" sx={{ color: '#666', fontWeight: 400 }}>{marker.salesperson}</Typography>
//                 </td>
//                 <td style={{ padding: '8px', color: '#222' }}>{marker.description}</td>
//                 <td style={{ padding: '8px' }}>
//                   <Chip label={marker.stage} sx={{ bgcolor: STAGE_COLORS[marker.stage]?.bg, color: STAGE_COLORS[marker.stage]?.text, fontWeight: 600, px: 1.5, fontSize: 15 }} size="small" />
//                 </td>
//                 <td style={{ padding: '8px' }}>
//                   <EditIcon sx={{ color: '#888', fontSize: 20, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onEdit(marker); }} />
//                   <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(marker); }}>
//                     <CloseIcon sx={{ color: '#e74c3c', fontSize: 20 }} />
//                   </IconButton>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </Box>
//     </Card>
//   );
// }




function Sidebar({ markers, onSelect, onAddClick, onEdit, onDelete, search, setSearch }) {
  return (
    <Card
      sx={{
        width: 420,
        borderRadius: 3,
        boxShadow: 3,
        p: 3,
        height: 'calc(100vh - 160px)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 320,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, color: '#222', fontWeight: 700 }}>
        Clients
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 1 }}
          InputProps={{ style: { color: '#222' } }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr>
              <th style={headerStyle}>Name</th>
              <th style={headerStyle}>Location</th>
              <th style={headerStyle}>Stage</th>
              <th style={headerStyle}>Edit</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {markers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: '#888', padding: '12px' }}>
                  No clients found
                </td>
              </tr>
            )}

            {markers.map((marker, idx) => {
              const hoverInfo = `
                Location: ${marker.description}
                Owner: ${marker.salesperson}
                Added: ${new Date(marker.timestamp).toLocaleDateString()}

              `.trim();

              return (
                <Tooltip title={<pre style={{ whiteSpace: 'pre-line' }}>{hoverInfo}</pre>} placement="top" arrow key={idx}>
                  <tr
                    onClick={() => onSelect(marker)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                      borderBottom: '1px solid #e0e0e0',
                    }}
                  >
                    <td style={cellStyle}>
                      <Typography variant="body1" fontWeight={600}>
                        {marker.site_name}
                      </Typography>
                      {/* <Typography variant="body2" color="text.secondary">
                        {marker.salesperson}
                      </Typography> */}
                    </td>
                    <td style={cellStyle}>
                      <Typography variant="body2">{marker.description}</Typography>
                    </td>
                    <td style={cellStyle}>
                      <Chip
                        label={marker.stage}
                        size="small"
                        sx={{
                          bgcolor: STAGE_COLORS[marker.stage]?.bg,
                          color: STAGE_COLORS[marker.stage]?.text,
                          fontWeight: 600,
                          px: 1.5,
                          fontSize: 13,
                        }}
                      />
                    </td>
                    <td style={cellStyle}>
                      <EditIcon
                        sx={{ color: '#888', fontSize: 20, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(marker);
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(marker);
                        }}
                      >
                        <CloseIcon sx={{ color: '#e74c3c', fontSize: 20 }} />
                      </IconButton>
                    </td>
                    <td></td>
                  </tr>
                </Tooltip>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Card>
  );
}

// Shared styles
const headerStyle = {
  textAlign: 'left',
  fontWeight: 600,
  color: '#222',
  fontSize: 15,
  padding: '8px',
  borderBottom: '2px solid #ccc',
};

const cellStyle = {
  padding: '8px',
  verticalAlign: 'top',
  color: '#222',
};

function SimpleMapWithSearch({user}) {
  const [loggedIn, setLoggedIn] = useState(false); // Set to true for demo
  const [markers, setMarkers] = useState([
    { site_name: 'Acme Corp', description: 'Ohio', salesperson: 'John', lat: 41.5, lng: -82.7, timestamp: new Date().toISOString(), stage: 'Pipeline' },
    { site_name: 'Globex Inc', description: 'West Virginia', salesperson: 'Jane', lat: 39.3, lng: -80.0, timestamp: new Date().toISOString(), stage: 'In Proposal' },
    { site_name: 'Stark Industries', description: 'New York', salesperson: 'Tony', lat: 43.0, lng: -76.0, timestamp: new Date().toISOString(), stage: 'POC Stage' },
    { site_name: 'Wayne Enterprises', description: 'Philadelphia', salesperson: 'Bruce', lat: 39.95, lng: -75.16, timestamp: new Date().toISOString(), stage: 'Current Client' },
    { site_name: 'Tech Solutions', description: 'California', salesperson: 'Alice', lat: 37.7749, lng: -122.4194, timestamp: new Date().toISOString(), stage: 'Pipeline' },
    { site_name: 'Global Systems', description: 'Texas', salesperson: 'Bob', lat: 32.7767, lng: -96.7970, timestamp: new Date().toISOString(), stage: 'Current Client' },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [formLatLng, setFormLatLng] = useState(null);
  const [formData, setFormData] = useState({ site_name: '', description: '', salesperson: '', stage: DEFAULT_STAGE });
  const [search, setSearch] = useState('');
  const [selectedMarkerIdx, setSelectedMarkerIdx] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const mapRef = useRef();
  const markerRefs = useRef([]);
  
  // const [markers, setMarkers] = useState([]);

  useEffect(() => {
    const isAdmin = user.email === 'admin@seewise.ai';
  
    const q = query(
      collection(db, 'clients'),
      ...(isAdmin ? [] : [where('salesperson', '==', user.email)]),
      orderBy('timestamp', 'desc')
    );
  
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMarkers(data);
    });
  
    return () => unsubscribe(); // Clean up on unmount
  }, [user.email]);
  

  // if (!user) {
  //   return <LoginPage onLogin ={()=> setLoggedIn(true)}/>
  // }

  const filteredMarkers = markers.filter(m =>
    m.site_name.toLowerCase().includes(search.toLowerCase()) ||
    m.stage.toLowerCase().includes(search.toLowerCase())
  );

  const handleMapClick = (latlng) => {
    setFormLatLng(latlng);
    setFormData({ site_name: '', description: '', salesperson: user.email, stage: DEFAULT_STAGE });
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const newMarker = {
      ...formData,
      lat: formLatLng.lat,
      lng: formLatLng.lng,
      timestamp: new Date().toISOString(),
    };

    try {
      if (editMode && editingId) {
        await updateDoc(doc(db, 'clients', editingId), newMarker);
      } else {
        await addDoc(collection(db, 'clients'), newMarker);
      }
      setShowForm(false);
      setEditMode(false);
      setEditingId(null);
      setFormLatLng(null);
      setFormData({ site_name: '', description: '', salesperson: '', stage: DEFAULT_STAGE });
    } catch (error) {
      console.error('Error saving document: ', error);
    }
  };
  

  const handleSidebarSelect = (marker) => {
    const idx = markers.findIndex(m => m.lat === marker.lat && m.lng === marker.lng && m.site_name === marker.site_name);
    setSelectedMarkerIdx(idx);
    if (mapRef.current) {
      const map = mapRef.current;
      const offsetX = SIDEBAR_WIDTH / 2;
      const markerPoint = map.project([marker.lat, marker.lng], map.getZoom());
      const centerPoint = L.point(markerPoint.x + offsetX, markerPoint.y);
      const centerLatLng = map.unproject(centerPoint, map.getZoom());
      map.flyTo(centerLatLng, FOCUS_ZOOM, { animate: true });
    }
    setTimeout(() => {
      if (markerRefs.current[idx]) {
        markerRefs.current[idx].openPopup();
      }
    }, 400);
  };

  const handleEdit = (marker) => {
    setFormLatLng({ lat: marker.lat, lng: marker.lng });
    setFormData({
      site_name: marker.site_name,
      description: marker.description,
      salesperson: marker.salesperson,
      stage: marker.stage,
    });
    setEditingId(marker.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleDelete = async (marker) => {
    if (window.confirm('Delete this client?')) {
      try {
        await deleteDoc(doc(db, 'clients', marker.id));
      } catch (err) {
        console.error('Delete failed', err);
      }
    }
  };

  const getMarkerIcon = (stage) => {
    const stageColors = {
      Pipeline: '#e74c3c',
      'In Proposal': '#f4b400',
      'POC Stage': '#4285f4',
      'Current Client': '#34a853',
    };
    
    return new L.Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${stageColors[stage] || '#4285f4'}" width="32" height="32">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      `)}`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', width: 'auto', bgcolor: '#f5faff', overflow: 'hidden' }}>
      <DashboardHeader
        clientCount={markers.length}
        onLogout={() => auth.signOut()}
      />
  
      <Box sx={{ display: 'flex', height: '100%', px: 3, py: 2, gap: 3 }}>
        <Sidebar
          markers={filteredMarkers}
          onSelect={handleSidebarSelect}
          onAddClick={() => setShowForm(true)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          search={search}
          setSearch={setSearch}
        />
  
        <Card
          sx={{
            flex: 1,
            borderRadius: 3,
            boxShadow: 3,
            p: 0,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1, position: 'relative' }}>
            <MapContainer
              center={[40.5, -80.5]}
              zoom={4}
              style={{ width: '100%', height: '100%' }}
              whenCreated={mapInstance => { mapRef.current = mapInstance; }}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <AddMarker onAdd={handleMapClick} />
              {markers.map((marker, idx) => (
                <Marker
                  key={idx}
                  position={[marker.lat, marker.lng]}
                  ref={el => markerRefs.current[idx] = el}
                  icon={getMarkerIcon(marker.stage)}
                >
                  <Popup autoPan>
                    <Box sx={{ minWidth: 200 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{marker.site_name}</Typography>
                      <Typography variant="body2">{marker.description}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Salesperson: {marker.salesperson}
                      </Typography>
                      <Chip
                        label={marker.stage}
                        sx={{
                          bgcolor: STAGE_COLORS[marker.stage]?.bg,
                          color: STAGE_COLORS[marker.stage]?.text,
                          fontWeight: 600,
                          mt: 1
                        }}
                        size="small"
                      />
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ mt: 1, color: 'text.secondary' }}
                      >
                        Added: {new Date(marker.timestamp).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
  
            {/* Search with Auto Suggest */}
            <EnhancedLocationSearch mapRef={mapRef} />
          </Box>
        </Card>
      </Box>
  
      {/* Add Client Dialog */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: PRIMARY_BG, color: FONT_LIGHT }}>
          Add Client
        </DialogTitle>
  
        <DialogContent sx={{ bgcolor: '#f3f6fb' }}>
          <TextField
            label="Client Name"
            name="site_name"
            value={formData.site_name}
            onChange={handleFormChange}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Location Description"
            name="description"
            value={formData.description}
            onChange={handleFormChange}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Salesperson Email"
            name="salesperson"
            value={formData.salesperson}
            onChange={handleFormChange}
            fullWidth
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="stage-label">Stage</InputLabel>
            <Select
              labelId="stage-label"
              name="stage"
              value={formData.stage}
              label="Stage"
              onChange={handleFormChange}
              required
            >
              {STAGES.map(stage => (
                <MenuItem key={stage} value={stage}>
                  {stage}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
  
        <DialogActions sx={{ bgcolor: '#f3f6fb' }}>
          <Button onClick={() => setShowForm(false)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleFormSubmit}
            variant="contained"
            sx={{
              bgcolor: ACCENT,
              color: FONT_LIGHT,
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#5393b6',
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
  
}

// export default App;