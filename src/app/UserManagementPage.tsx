import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createUser, fetchUsers, updateUser } from "@/services/user";
import type { AccountRole, CreateUserRequest, UpdateUserRequest, UserResponse } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleOptions: Array<{ label: string; value: AccountRole }> = [
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
];

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

const defaultForm: CreateUserRequest = {
  username: "",
  email: "",
  password: "",
  roles: ["user"],
};

const defaultEditForm: UpdateUserRequest = {
  username: "",
  email: "",
  roles: ["user"],
};

const UserManagementPage = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>(defaultForm);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>(defaultEditForm);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const totalUsers = useMemo(() => users.length, [users]);

  function resetCreateForm() {
    setForm(defaultForm);
  }

  function resetEditForm() {
    setEditForm(defaultEditForm);
    setEditingUser(null);
    setEditError(null);
  }

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat user";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function handleFormChange(key: keyof CreateUserRequest, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleEditFormChange(key: keyof UpdateUserRequest, value: string) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function openEditModal(user: UserResponse) {
    const fallbackRole = user.roles.includes("admin") ? "admin" : "user";
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      roles: [fallbackRole],
    });
    setEditError(null);
    setEditSuccess(null);
    setShowEditModal(true);
  }

  async function handleSubmitUserForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!form.username.trim() || !form.email.trim()) {
      setSubmitError("Username dan email wajib diisi.");
      return;
    }

    const selectedRole = form.roles[0];
    if (!selectedRole) {
      setSubmitError("Role wajib dipilih.");
      return;
    }

    setSubmitLoading(true);
    try {
      await createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password?.trim() || undefined,
        roles: [selectedRole],
      });

      setSubmitSuccess("User berhasil ditambahkan.");
      await loadUsers();
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan user";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleSubmitEditUserForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    if (!editingUser) {
      setEditError("User tidak ditemukan.");
      return;
    }

    if (!editForm.username.trim() || !editForm.email.trim()) {
      setEditError("Username dan email wajib diisi.");
      return;
    }

    const selectedRole = editForm.roles[0];
    if (!selectedRole) {
      setEditError("Role wajib dipilih.");
      return;
    }

    setEditLoading(true);
    try {
      await updateUser(editingUser.id, {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        roles: [selectedRole],
      });
      setEditSuccess("User berhasil diperbarui.");
      setSubmitSuccess("User berhasil diperbarui.");
      await loadUsers();
      setShowEditModal(false);
      resetEditForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memperbarui user";
      setEditError(message);
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100">
          <CardDescription className="text-primary text-[11px] font-bold tracking-[0.08em] uppercase">
            Jejak User Management
          </CardDescription>
          <CardTitle className="font-serif text-3xl">Kelola User</CardTitle>
          <CardDescription className="max-w-2xl text-xs">
            Admin dapat menambah user baru dengan role user atau admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <Badge variant="outline">Total User: {totalUsers}</Badge>
          <Button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setSubmitSuccess(null);
              setShowCreateModal(true);
            }}
          >
            Tambah User
          </Button>
          <Button type="button" variant="outline" onClick={loadUsers} disabled={loading}>
            {loading ? "Memuat..." : "Muat Ulang"}
          </Button>
        </CardContent>
      </Card>

      {submitSuccess && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-700">{submitSuccess}</CardContent>
        </Card>
      )}

      {editSuccess && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-xs text-emerald-700">{editSuccess}</CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-xs text-rose-700">{error}</CardContent>
        </Card>
      )}

      {loading && !error && (
        <Card>
          <CardContent className="py-3 text-xs">Sedang memuat data user...</CardContent>
        </Card>
      )}

      {!loading && !error && users.length === 0 && (
        <Card>
          <CardContent className="py-3 text-xs">Belum ada data user.</CardContent>
        </Card>
      )}

      {!loading && !error && users.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={`${user.id}-${role}`} variant="outline">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">Tanpa Role</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditModal(user)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah User</DialogTitle>
            <DialogDescription>Isi data user baru dan pilih role user atau admin.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-1 gap-3" onSubmit={handleSubmitUserForm}>
            <Label className="grid gap-1">
              <span>Username</span>
              <Input
                value={form.username}
                onChange={(event) => handleFormChange("username", event.target.value)}
                placeholder="Masukkan username"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Email</span>
              <Input
                value={form.email}
                onChange={(event) => handleFormChange("email", event.target.value)}
                placeholder="Masukkan email"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Password</span>
              <Input
                type="password"
                value={form.password || ""}
                onChange={(event) => handleFormChange("password", event.target.value)}
                placeholder="Opsional, minimal 8 karakter"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Role</span>
              <Select
                value={form.roles[0] || "user"}
                onValueChange={(value) => setForm((current) => ({ ...current, roles: [value as AccountRole] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? "Menyimpan..." : "Simpan User"}
            </Button>
            {submitError && (
              <Card className="border-rose-200 bg-rose-50">
                <CardContent className="py-3 text-xs text-rose-700">{submitError}</CardContent>
              </Card>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) {
            resetEditForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Perbarui data user dan role.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-1 gap-3" onSubmit={handleSubmitEditUserForm}>
            <Label className="grid gap-1">
              <span>Username</span>
              <Input
                value={editForm.username}
                onChange={(event) => handleEditFormChange("username", event.target.value)}
                placeholder="Masukkan username"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Email</span>
              <Input
                value={editForm.email}
                onChange={(event) => handleEditFormChange("email", event.target.value)}
                placeholder="Masukkan email"
              />
            </Label>
            <Label className="grid gap-1">
              <span>Role</span>
              <Select
                value={editForm.roles[0] || "user"}
                onValueChange={(value) => setEditForm((current) => ({ ...current, roles: [value as AccountRole] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Button type="submit" disabled={editLoading}>
              {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
            {editError && (
              <Card className="border-rose-200 bg-rose-50">
                <CardContent className="py-3 text-xs text-rose-700">{editError}</CardContent>
              </Card>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default UserManagementPage;