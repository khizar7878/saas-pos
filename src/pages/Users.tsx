import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Trash2, 
  Key, 
  Settings2,
  Loader2,
  Users,
  Lock
} from 'lucide-react';

const UsersPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const { 
    users, 
    routes, 
    usersLoading, 
    routesLoading,
    getUserPermissions,
    createUser, 
    updateUser, 
    updatePermissions,
    deleteUser,
    resetPassword,
  } = useUserManagement();

  // New user form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);

  // Edit permissions state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editRoleName, setEditRoleName] = useState('');
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Reset password state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Show loading state
  if (permissionsLoading || usersLoading || routesLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show access denied for non-admins (no redirect, no toast spam)
  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Shield className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">This page is restricted to administrators only.</p>
        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    );
  }

  // Group routes by parent
  const groupedRoutes = routes.reduce((acc, route) => {
    const group = route.parent_name || 'Main';
    if (!acc[group]) acc[group] = [];
    acc[group].push(route);
    return acc;
  }, {} as Record<string, typeof routes>);

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    await createUser.mutateAsync({
      email: newEmail,
      password: newPassword,
      fullName: newFullName,
      isAdmin: newIsAdmin,
      routeIds: newIsAdmin ? [] : selectedRoutes,
      customRoleName: newRoleName,
    });

    // Reset form
    setShowAddDialog(false);
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewIsAdmin(false);
    setNewRoleName('');
    setSelectedRoutes([]);
  };

  const handleEditPermissions = async (userId: string) => {
    setEditingUser(userId);
    const userToEdit = users.find(u => u.id === userId);
    setEditRoleName(userToEdit?.custom_role_name || '');
    setLoadingPermissions(true);
    try {
      const permissions = await getUserPermissions(userId);
      setEditPermissions(permissions);
    } catch (error) {
      toast.error('Failed to load permissions');
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    
    // Update permissions
    await updatePermissions.mutateAsync({
      userId: editingUser,
      routeIds: editPermissions,
    });
    
    // Update role name
    await updateUser.mutateAsync({
      userId: editingUser,
      customRoleName: editRoleName,
    });
    
    setEditingUser(null);
    setEditPermissions([]);
    setEditRoleName('');
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newResetPassword) return;
    if (newResetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    await resetPassword.mutateAsync({
      userId: resetUserId,
      newPassword: newResetPassword,
    });
    setResetUserId(null);
    setNewResetPassword('');
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    await deleteUser.mutateAsync(deleteUserId);
    setDeleteUserId(null);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await updateUser.mutateAsync({
      userId,
      isActive: !currentActive,
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage POS users and their access permissions
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new POS user and assign their access permissions
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleName">Custom Role Name (Optional)</Label>
                  <Input
                    id="roleName"
                    placeholder="e.g. Store Manager, Head Cashier"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Administrator Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Admins have full access to all features including user management
                    </p>
                  </div>
                  <Switch
                    checked={newIsAdmin}
                    onCheckedChange={setNewIsAdmin}
                  />
                </div>

                {!newIsAdmin && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label>Route Permissions</Label>
                      <p className="text-sm text-muted-foreground">
                        Select which sections this user can access
                      </p>
                      <ScrollArea className="h-60 border rounded-lg p-4">
                        {Object.entries(groupedRoutes).map(([group, groupRoutes]) => (
                          <div key={group} className="mb-4">
                            <h4 className="font-medium text-sm mb-2">{group}</h4>
                            <div className="space-y-2 ml-4">
                              {groupRoutes.map((route) => (
                                <div key={route.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={route.id}
                                    checked={selectedRoutes.includes(route.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedRoutes([...selectedRoutes, route.id]);
                                      } else {
                                        setSelectedRoutes(selectedRoutes.filter(id => id !== route.id));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={route.id}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {route.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={createUser.isPending}
                >
                  {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Users</CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.custom_role_name ? (
                        <Badge variant="outline" className="font-medium bg-muted/50">
                          {user.is_admin && <ShieldCheck className="w-3 h-3 mr-1 text-primary" />}
                          {!user.is_admin && <Shield className="w-3 h-3 mr-1" />}
                          {user.custom_role_name}
                        </Badge>
                      ) : user.is_admin ? (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" />
                          User
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                        disabled={user.is_admin}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_admin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPermissions(user.id)}
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetUserId(user.id)}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        {!user.is_admin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteUserId(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users found. Add your first user above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              Manage which sections this user can access
            </DialogDescription>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 px-1">
                <Label htmlFor="editRoleName">Custom Role Name</Label>
                <Input
                  id="editRoleName"
                  placeholder="e.g. Store Manager, Head Cashier"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                />
              </div>
              <ScrollArea className="h-72 border rounded-lg p-4">
              {Object.entries(groupedRoutes).map(([group, groupRoutes]) => (
                <div key={group} className="mb-4">
                  <h4 className="font-medium text-sm mb-2">{group}</h4>
                  <div className="space-y-2 ml-4">
                    {groupRoutes.map((route) => (
                      <div key={route.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${route.id}`}
                          checked={editPermissions.includes(route.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditPermissions([...editPermissions, route.id]);
                            } else {
                              setEditPermissions(editPermissions.filter(id => id !== route.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`edit-${route.id}`}
                          className="text-sm font-medium leading-none"
                        >
                          {route.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
           </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSavePermissions}
              disabled={updatePermissions.isPending}
            >
              {updatePermissions.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUserId} onOpenChange={(open) => !open && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Enter a new password for this user
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimum 6 characters"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUserId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
