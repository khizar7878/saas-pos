
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Store, Shield } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';

const StoreLogo = ({ settings, loading }: { settings: any, loading: boolean }) => {
  const [imageError, setImageError] = useState(false);

  if (loading) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (settings?.logo_url && !imageError) {
    return (
      <img
        src={settings.logo_url}
        alt={settings.store_name}
        className="h-64 w-auto object-contain"
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: Default Store Icon
  return (
    <div className="h-64 w-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Store className="h-24 w-24 opacity-20" />
    </div>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useStoreSettings();
  const { allowedRoutes, isAdmin, loading: permissionsLoading } = usePermissions();

  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Redirect if already logged in - Check permissions for correct landing page
  useEffect(() => {
    if (user && !permissionsLoading) {
      let target = '/';

      const routes = allowedRoutes || [];

      if (!isAdmin && routes.length > 0) {
        // Check if user has access to Dashboard
        const hasDashboardAccess = routes.some(r => r.path === '/');

        if (!hasDashboardAccess) {
          // Redirect to first allowed route
          target = routes[0].path;
        }
      }

      navigate(target);
    }
  }, [user, permissionsLoading, isAdmin, allowedRoutes, navigate]);

  if (user && permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return null; // Wait for redirect

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Please verify your email address');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            {/* Logo is now fetched from settings if available, or fallback to default */}
            <StoreLogo settings={settings} loading={settingsLoading} />
          </div>
          {/* <CardTitle className="text-2xl">Abr e Karam Fabrics</CardTitle>  <-- Removed as per request */}
          <CardDescription>Point of Sale System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Authorized personnel only</span>
          </div>
          <p className="text-xs">Contact your administrator for access</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Auth;
