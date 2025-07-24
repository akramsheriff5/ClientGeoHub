import { Box, Typography, CircularProgress, useTheme } from "@mui/material";
import { Map, MapOutlined, Public, GpsFixed } from "@mui/icons-material";

const iconMap = {
  default: <Map fontSize="large" />,
  globe: <Public fontSize="large" />,
  gps: <GpsFixed fontSize="large" />,
  outline: <MapOutlined fontSize="large" />,
};

export default function MapLoading({ text = "Loading Map...", variant = "default" }) {
  const theme = useTheme();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      textAlign="center"
      sx={{
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      <Box mb={2} sx={{ animation: "pulse 2s infinite ease-in-out" }}>
        {iconMap[variant] || iconMap["default"]}
      </Box>
      <CircularProgress color="primary" />
      <Typography variant="h6" mt={2}>
        {text}
      </Typography>

      {/* Pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0.6; }
          }
        `}
      </style>
    </Box>
  );
}
