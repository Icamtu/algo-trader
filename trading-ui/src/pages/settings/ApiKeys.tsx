import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Eye, EyeOff, Trash2, Plus, Lock, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BrokerCredential {
  id: string;
  name: string;
  connected: boolean;
  lastUpdated: string;
  username?: string;
}

interface AiProvider {
  id: string;
  name: string;
  configured: boolean;
  lastUsed: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  lastFired: string;
  createdAt: string;
}

interface ApiToken {
  id: string;
  appName: string;
  scopes: string[];
  created: string;
  lastUsed: string;
  preview: string;
  expiresAt: string | null;
}

export default function ApiKeys() {
  const { toast } = useToast();

  // Broker Credentials
  const [brokerConnected, setBrokerConnected] = useState(true);
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [brokerForm, setBrokerForm] = useState({
    username: '',
    password: '',
    endpoint: 'https://api.shoonya.com',
  });
  const [testingBroker, setTestingBroker] = useState(false);

  // API Providers
  const [providers, setProviders] = useState<AiProvider[]>([
    { id: 'openai', name: 'OpenAI', configured: false, lastUsed: 'Never' },
    { id: 'anthropic', name: 'Anthropic', configured: false, lastUsed: 'Never' },
    { id: 'local', name: 'Local LLM', configured: false, lastUsed: 'Never' },
  ]);
  const [showProviderForms, setShowProviderForms] = useState<Record<string, boolean>>({});
  const [providerForms, setProviderForms] = useState<Record<string, { apiKey?: string; endpoint?: string }>>({
    openai: { apiKey: '' },
    anthropic: { apiKey: '' },
    local: { endpoint: '' },
  });
  const [showProviderKeys, setShowProviderKeys] = useState<Record<string, boolean>>({});

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: 'wh-001',
      url: 'https://myserver.com/webhooks/trade-closed',
      events: ['Trade Closed'],
      lastFired: '2026-04-29 14:32:00',
      createdAt: '2026-04-15',
    },
  ]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    events: [] as string[],
    secret: '',
  });
  const [generatingSecret, setGeneratingSecret] = useState(false);

  // API Tokens
  const [tokens, setTokens] = useState<ApiToken[]>([
    {
      id: 'tok-001',
      appName: 'TradingBot v2',
      scopes: ['read-only'],
      created: '2026-03-01',
      lastUsed: '2026-04-29 15:45:00',
      preview: 'sk_live_****o9k2',
      expiresAt: null,
    },
  ]);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    appName: '',
    scopes: ['read-only'] as string[],
    expiry: '90d' as string,
  });

  const maskSecret = (value: string) => `●●●●●●●●${value.slice(-4)}`;

  const testBrokerConnection = async () => {
    setTestingBroker(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({
        title: 'Connection Successful',
        description: 'Shoonya broker connection verified.',
      });
      setBrokerConnected(true);
      setShowBrokerForm(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Could not connect to Shoonya. Check credentials.',
      });
    } finally {
      setTestingBroker(false);
    }
  };

  const generateWebhookSecret = async () => {
    setGeneratingSecret(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const secret = `wh_secret_${Math.random().toString(36).substring(2, 15)}`;
      setWebhookForm(prev => ({ ...prev, secret }));
    } finally {
      setGeneratingSecret(false);
    }
  };

  const saveWebhook = () => {
    if (!webhookForm.url || webhookForm.events.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'URL and at least one event are required.',
      });
      return;
    }
    const newWebhook: Webhook = {
      id: `wh-${Date.now()}`,
      url: webhookForm.url,
      events: webhookForm.events,
      lastFired: 'Never',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setWebhooks([...webhooks, newWebhook]);
    setWebhookForm({ url: '', events: [], secret: '' });
    setShowWebhookForm(false);
    toast({
      title: 'Webhook Created',
      description: 'New webhook endpoint registered.',
    });
  };

  const createToken = () => {
    if (!tokenForm.appName) {
      toast({
        variant: 'destructive',
        title: 'Missing App Name',
        description: 'Please provide an app name.',
      });
      return;
    }
    const newToken: ApiToken = {
      id: `tok-${Date.now()}`,
      appName: tokenForm.appName,
      scopes: tokenForm.scopes,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      preview: `sk_live_****${Math.random().toString(36).substring(2, 6)}`,
      expiresAt: tokenForm.expiry === 'never' ? null : new Date(Date.now() + (parseInt(tokenForm.expiry) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    };
    setTokens([...tokens, newToken]);
    setTokenForm({ appName: '', scopes: ['read-only'], expiry: '90d' });
    setShowTokenForm(false);
    toast({
      title: 'API Token Created',
      description: 'New token generated. Save it now—you won\'t see it again.',
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-6">
        <div>
          <h1 className="text-3xl font-black font-display uppercase tracking-widest text-foreground">
            API & Apps
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-2">
            Broker credentials, API keys, webhooks, and app tokens
          </p>
        </div>
      </div>

      {/* BROKER CREDENTIALS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4 p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider">
              Broker Credentials (Shoonya)
            </h3>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Primary broker connection for live trading
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-3 py-1 rounded-lg text-[8px] font-mono font-black uppercase',
            brokerConnected
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          )}>
            <div className={cn('w-2 h-2 rounded-full', brokerConnected ? 'bg-green-400' : 'bg-red-400')} />
            {brokerConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {!showBrokerForm ? (
          brokerConnected ? (
            <div className="space-y-3">
              <div className="p-3 bg-black/20 border border-border/20 rounded-lg">
                <div className="text-[9px] text-muted-foreground/60 mb-1">Username</div>
                <div className="text-[11px] font-mono font-black text-foreground">
                  {maskSecret('trader_account_001')}
                </div>
              </div>
              <button
                onClick={() => setShowBrokerForm(true)}
                className="w-full p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
              >
                Rotate Credentials
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-300">
                  Broker not connected. Enter credentials to enable live trading.
                </p>
              </div>
              <button
                onClick={() => setShowBrokerForm(true)}
                className="w-full p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
              >
                Connect Broker
              </button>
            </div>
          )
        ) : (
          <div className="space-y-3 p-4 border border-primary/20 bg-primary/5 rounded-lg">
            <input
              type="text"
              placeholder="Shoonya Username"
              value={brokerForm.username}
              onChange={(e) => setBrokerForm(prev => ({ ...prev, username: e.target.value }))}
              className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
            />
            <input
              type="password"
              placeholder="Shoonya Password"
              value={brokerForm.password}
              onChange={(e) => setBrokerForm(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
            />
            <input
              type="text"
              placeholder="Endpoint (default: https://api.shoonya.com)"
              value={brokerForm.endpoint}
              onChange={(e) => setBrokerForm(prev => ({ ...prev, endpoint: e.target.value }))}
              className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={testBrokerConnection}
                disabled={testingBroker || !brokerForm.username || !brokerForm.password}
                className="flex-1 p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {testingBroker ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setShowBrokerForm(false)}
                className="flex-1 p-2 border border-border/40 bg-white/5 text-muted-foreground rounded-lg text-[9px] font-black uppercase hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* AI PROVIDER KEYS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider px-6">
          AI Provider Keys
        </h3>
        <div className="grid gap-4">
          {providers.map((provider, idx) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              className="p-6 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-black text-foreground uppercase tracking-wider">
                    {provider.name}
                  </h4>
                  <p className="text-[8px] text-muted-foreground/60 mt-1">
                    Last used: {provider.lastUsed}
                  </p>
                </div>
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-[8px] font-mono font-black uppercase',
                  provider.configured
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-slate-500/10 text-slate-400'
                )}>
                  {provider.configured && <CheckCircle2 className="w-3 h-3" />}
                  {provider.configured ? 'Configured' : 'Not Configured'}
                </div>
              </div>

              {!showProviderForms[provider.id] ? (
                provider.configured ? (
                  <button
                    onClick={() => setShowProviderForms(p => ({ ...p, [provider.id]: true }))}
                    className="w-full p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
                  >
                    Rotate Key
                  </button>
                ) : (
                  <button
                    onClick={() => setShowProviderForms(p => ({ ...p, [provider.id]: true }))}
                    className="w-full p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
                  >
                    Add Key
                  </button>
                )
              ) : (
                <div className="space-y-2 p-3 border border-primary/20 bg-primary/5 rounded-lg">
                  {provider.id !== 'local' ? (
                    <div>
                      <label className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">API Key</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type={showProviderKeys[provider.id] ? 'text' : 'password'}
                          placeholder={`${provider.name} API Key`}
                          value={providerForms[provider.id]?.apiKey || ''}
                          onChange={(e) => setProviderForms(p => ({
                            ...p,
                            [provider.id]: { ...p[provider.id], apiKey: e.target.value }
                          }))}
                          className="flex-1 bg-black/40 border border-border/40 rounded px-2 py-1 text-[8px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                        />
                        <button
                          onClick={() => setShowProviderKeys(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                          className="p-1 hover:bg-white/10 rounded transition-all"
                        >
                          {showProviderKeys[provider.id] ? (
                            <EyeOff className="w-3 h-3 text-muted-foreground/60" />
                          ) : (
                            <Eye className="w-3 h-3 text-muted-foreground/60" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Endpoint URL</label>
                      <input
                        type="url"
                        placeholder="http://localhost:8000"
                        value={providerForms[provider.id]?.endpoint || ''}
                        onChange={(e) => setProviderForms(p => ({
                          ...p,
                          [provider.id]: { ...p[provider.id], endpoint: e.target.value }
                        }))}
                        className="w-full bg-black/40 border border-border/40 rounded px-2 py-1 text-[8px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 mt-1"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowProviderForms(p => ({ ...p, [provider.id]: false }))}
                      className="flex-1 p-1 border border-primary/40 bg-primary/10 text-primary rounded text-[8px] font-black uppercase hover:bg-primary/20 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowProviderForms(p => ({ ...p, [provider.id]: false }))}
                      className="flex-1 p-1 border border-border/40 bg-white/5 text-muted-foreground rounded text-[8px] font-black uppercase hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* WEBHOOKS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between px-6">
          <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider">
            Outbound Webhooks
          </h3>
          {!showWebhookForm && (
            <button
              onClick={() => setShowWebhookForm(true)}
              className="p-1.5 border border-primary/40 bg-primary/10 text-primary rounded text-[8px] font-black uppercase hover:bg-primary/20 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {showWebhookForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 border border-primary/20 bg-primary/5 rounded-lg space-y-3 mx-6"
          >
            <input
              type="url"
              placeholder="https://myserver.com/webhooks/..."
              value={webhookForm.url}
              onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
              className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
            />

            <div className="space-y-2">
              <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                Events
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Trade Closed', 'Strategy Updated', 'Error Triggered', 'Position Changed'].map((event) => (
                  <button
                    key={event}
                    onClick={() => setWebhookForm(prev => ({
                      ...prev,
                      events: prev.events.includes(event)
                        ? prev.events.filter(e => e !== event)
                        : [...prev.events, event]
                    }))}
                    className={cn(
                      'p-2 border rounded-lg text-[8px] font-black uppercase tracking-wider transition-all',
                      webhookForm.events.includes(event)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
                    )}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                  Signing Secret
                </label>
                <button
                  onClick={generateWebhookSecret}
                  disabled={generatingSecret}
                  className="text-[8px] text-primary font-black hover:text-primary/60 transition-colors disabled:opacity-50"
                >
                  {generatingSecret ? 'Generating...' : 'Generate'}
                </button>
              </div>
              <input
                type="text"
                placeholder="Auto-generate or paste existing"
                value={webhookForm.secret}
                readOnly
                className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-muted-foreground/60 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveWebhook}
                className="flex-1 p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
              >
                Add Webhook
              </button>
              <button
                onClick={() => setShowWebhookForm(false)}
                className="flex-1 p-2 border border-border/40 bg-white/5 text-muted-foreground rounded-lg text-[9px] font-black uppercase hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid gap-3 px-6">
          {webhooks.map((wh) => (
            <motion.div
              key={wh.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-mono text-muted-foreground/60 truncate">{wh.url}</p>
                  <p className="text-[8px] text-muted-foreground/40 mt-1">
                    Events: {wh.events.join(', ')} • Fired: {wh.lastFired}
                  </p>
                </div>
                <button
                  onClick={() => setWebhooks(webhooks.filter(w => w.id !== wh.id))}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* API TOKENS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between px-6">
          <h3 className="text-[12px] font-black text-foreground uppercase tracking-wider">
            Inbound API Tokens
          </h3>
          {!showTokenForm && (
            <button
              onClick={() => setShowTokenForm(true)}
              className="p-1.5 border border-primary/40 bg-primary/10 text-primary rounded text-[8px] font-black uppercase hover:bg-primary/20 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {showTokenForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 border border-primary/20 bg-primary/5 rounded-lg space-y-3 mx-6"
          >
            <input
              type="text"
              placeholder="App name (e.g., TradingBot v2)"
              value={tokenForm.appName}
              onChange={(e) => setTokenForm(prev => ({ ...prev, appName: e.target.value }))}
              className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-all"
            />

            <div className="space-y-2">
              <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                Scopes
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['read-only', 'read-write'].map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setTokenForm(prev => ({
                      ...prev,
                      scopes: prev.scopes.includes(scope)
                        ? prev.scopes.filter(s => s !== scope)
                        : [...prev.scopes, scope]
                    }))}
                    className={cn(
                      'p-2 border rounded-lg text-[8px] font-black uppercase tracking-wider transition-all',
                      tokenForm.scopes.includes(scope)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 bg-white/5 text-muted-foreground/60 hover:border-primary/40'
                    )}
                  >
                    {scope.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-foreground uppercase tracking-wider">
                Expiry
              </label>
              <select
                value={tokenForm.expiry}
                onChange={(e) => setTokenForm(prev => ({ ...prev, expiry: e.target.value }))}
                className="w-full bg-black/40 border border-border/40 rounded-lg px-3 py-2 text-[9px] font-mono text-foreground focus:outline-none focus:border-primary/60 transition-all"
              >
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createToken}
                className="flex-1 p-2 border border-primary/40 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary/20 transition-all"
              >
                Create Token
              </button>
              <button
                onClick={() => setShowTokenForm(false)}
                className="flex-1 p-2 border border-border/40 bg-white/5 text-muted-foreground rounded-lg text-[9px] font-black uppercase hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid gap-3 px-6">
          {tokens.map((token) => (
            <motion.div
              key={token.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-border/20 bg-slate-950/40 backdrop-blur-sm rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[10px] font-black text-foreground uppercase">
                    {token.appName}
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground/60 mt-1">
                    {token.preview}
                  </div>
                  <div className="text-[8px] text-muted-foreground/40 mt-1">
                    Created: {token.created} • Last used: {token.lastUsed}
                    {token.expiresAt && ` • Expires: ${token.expiresAt}`}
                  </div>
                </div>
                <button
                  onClick={() => setTokens(tokens.filter(t => t.id !== token.id))}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
              <div className="flex gap-1 pt-1">
                {token.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-[7px] font-mono font-black text-primary rounded uppercase"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
