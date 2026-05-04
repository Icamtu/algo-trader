import React, { useState } from 'react';
import { Mail, Fingerprint, ShieldCheck, Settings2, Upload, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState([
    { id: 'session-1', device: 'Chrome on macOS', location: 'San Francisco, CA', lastActivity: '2 minutes ago' },
    { id: 'session-2', device: 'Safari on iOS', location: 'San Francisco, CA', lastActivity: '1 hour ago' },
  ]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
        toast({
          title: 'Avatar Updated',
          description: 'Your profile picture has been updated.',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignOutSession = (sessionId: string) => {
    setActiveSessions(activeSessions.filter(s => s.id !== sessionId));
    toast({
      title: 'Session Signed Out',
      description: 'The session has been ended.',
    });
  };

  const stats = [
    { label: "Account Created", value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown' },
    { label: "Identity Hash", value: user?.id?.slice(0, 12) + "..." || 'N/A' },
    { label: "Security Status", value: "Verified" },
    { label: "Auth Provider", value: user?.app_metadata?.provider || "Supabase" }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-6">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
            Profile
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-2">
            Manage your account details, security, and sessions
          </p>
        </div>
      </div>

      {/* Avatar & Basic Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="border border-white/5 bg-slate-950/40 backdrop-blur-md p-8 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Fingerprint className="w-32 h-32 text-primary" />
        </div>

        <div className="flex items-center gap-8 relative z-10">
          {/* Avatar */}
          <div className="relative group/avatar">
            <div className={cn(
              "w-24 h-24 bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-mono text-4xl font-black text-black rounded-lg overflow-hidden"
            )}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.email?.[0].toUpperCase()
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Upload className="w-5 h-5 text-white" />
            </label>
          </div>

          {/* Basic Info */}
          <div className="space-y-1 flex-1">
            <div>
              <label className="text-[9px] font-mono font-black text-muted-foreground/60 uppercase tracking-widest">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full text-2xl font-black font-display uppercase tracking-widest text-foreground bg-transparent border-b border-border/20 pb-2 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="px-2 py-0.5 bg-primary/20 border border-primary/30 text-[8px] font-mono font-black text-primary uppercase">
                Identity_Verified
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mt-12">
          {stats.map((s) => (
            <div key={s.label} className="p-4 border border-white/5 bg-white/5">
              <span className="text-[9px] font-mono font-black text-muted-foreground/30 uppercase tracking-[0.2em] block mb-2">
                {s.label}
              </span>
              <span className="text-sm font-black font-mono text-foreground uppercase">{s.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Password Change */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 border border-white/5 bg-slate-950/40 backdrop-blur-md space-y-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase text-foreground">Password Security</h4>
            <p className="text-[9px] font-mono text-muted-foreground uppercase mt-1">Update your login password</p>
          </div>
        </div>
        <button
          onClick={() => setShowChangePasswordModal(true)}
          className="w-full px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
        >
          Change Password
        </button>

        {showChangePasswordModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
          >
            <div className="bg-slate-950 border border-border/20 rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
              <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider">
                Change Password
              </h3>
              <input
                type="password"
                placeholder="Current password"
                className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
              />
              <input
                type="password"
                placeholder="New password"
                className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 px-4 py-2 border border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* 2FA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-6 border border-white/5 bg-slate-950/40 backdrop-blur-md space-y-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black uppercase text-foreground">Two-Factor Authentication</h4>
            <p className="text-[9px] font-mono text-muted-foreground uppercase mt-1">
              Status: {twoFAEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <button
            onClick={() => setShow2FAModal(true)}
            className="px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
          >
            {twoFAEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {show2FAModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
          >
            <div className="bg-slate-950 border border-border/20 rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
              <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider">
                Enable 2FA
              </h3>
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg flex items-center justify-center">
                <div className="w-32 h-32 bg-white rounded flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-[11px] font-black text-slate-950">QR Code</span>
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="6-digit code from authenticator"
                className="w-full bg-black/40 border border-border/40 rounded-lg px-4 py-2 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setTwoFAEnabled(true);
                    setShow2FAModal(false);
                    toast({ title: '2FA Enabled', description: 'Two-factor authentication is now active.' });
                  }}
                  className="flex-1 px-4 py-2 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                >
                  Verify & Enable
                </button>
                <button
                  onClick={() => setShow2FAModal(false)}
                  className="flex-1 px-4 py-2 border border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Active Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 border border-white/5 bg-slate-950/40 backdrop-blur-md space-y-4"
      >
        <div className="flex items-center gap-4 border-b border-white/5 pb-4">
          <div className="p-2 bg-primary/10 border border-primary/20">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase text-foreground">Active Sessions</h4>
            <p className="text-[9px] font-mono text-muted-foreground uppercase mt-1">Manage your login sessions</p>
          </div>
        </div>

        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 border border-border/20 bg-white/5 rounded-lg"
            >
              <div>
                <div className="text-[10px] font-black text-foreground uppercase">{session.device}</div>
                <div className="text-[8px] text-muted-foreground/60 mt-1">
                  {session.location} • {session.lastActivity}
                </div>
              </div>
              <button
                onClick={() => handleSignOutSession(session.id)}
                className="px-3 py-1 border border-destructive/20 bg-destructive/10 text-[8px] font-black uppercase text-destructive hover:bg-destructive/20 transition-all"
              >
                Sign Out
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
