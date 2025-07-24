import React, { useState } from 'react';
import {
  Button, TextField, Box, Typography, Card, CardContent, Link, Tabs, Tab
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import GroupIcon from '@mui/icons-material/Group';
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';

function LoginPage({ onLogin = () => {} }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.endsWith('@seewise.ai')) {
      alert('Only @seewise.ai emails are allowed to register.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with display name
      if (fullName.trim()) {
        await updateProfile(userCredential.user, {
          displayName: fullName.trim()
        });
      }
      
      alert('Account created successfully!');
      onLogin();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (e, newValue) => {
    setMode(newValue);
    // Reset form fields when switching modes
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5faff 0%, #e3f0ff 100%)',
      p: 2
    }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          mb: 2, textAlign: 'center'
        }}>
          <Box sx={{
            bgcolor: '#4285f4', color: '#fff', borderRadius: 2, p: 2, mb: 1,
            boxShadow: 2, display: 'flex', alignItems: 'center', gap: 1
          }}>
            <LocationOnIcon sx={{ fontSize: 30 }} />
            <GroupIcon sx={{ fontSize: 24 }} />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{color:'text.primary'}}>Client Geo Hub</Typography>
          <Typography variant="subtitle1" sx={{ color: '#555' }}>
            Manage clients across the globe
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: 3, p: 3 }}>
          <CardContent sx={{ p: 0 }}>
            <Tabs value={mode} onChange={handleTabChange} centered>
              <Tab label="Sign In" value="login" />
              <Tab label="Sign Up" value="register" />
            </Tabs>

            {mode === 'login' && (
              <Box component="form" onSubmit={handleLogin}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label="Email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required fullWidth placeholder="Enter your email"
                />
                <TextField
                  label="Password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required fullWidth placeholder="Enter your password"
                />
                <Button
                  type="submit" variant="contained" fullWidth disabled={loading}
                  sx={{ bgcolor: '#4285f4', color: '#fff', fontWeight: 600 }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
{/*                 
                <Link
                  href="#" underline="hover"
                  sx={{ color: '#4285f4', fontSize: 14, textAlign: 'center', mt: 1 }}
                >
                  Forgot password?
                </Link> */}
              </Box>
            )}

            {mode === 'register' && (
              <Box component="form" onSubmit={handleRegister}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label="Full Name" type="text" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  fullWidth placeholder="Enter your full name"
                />
                <TextField
                  label="Email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required fullWidth placeholder="Enter your email"
                />
                <TextField
                  label="Password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required fullWidth placeholder="Create a password (min 6 characters)"
                />
                <TextField
                  label="Confirm Password" type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required fullWidth placeholder="Confirm your password"
                />
                <Button
                  type="submit" variant="contained" fullWidth disabled={loading}
                  sx={{ bgcolor: '#4285f4', color: '#fff', fontWeight: 600 }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </Box>
            )}

            <Box sx={{
              bgcolor: '#f5f6fa', color: '#888', borderRadius: 2,
              mt: 3, p: 1.5, textAlign: 'center', fontSize: 15
            }}>
              {mode === 'login' 
                ? '' 
                : 'Create your account to get started'
              }
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default LoginPage;