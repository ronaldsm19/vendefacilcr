"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminSession } from "@/components/admin/SessionContext";
import type { StaffRole } from "@/lib/permissions";
import { Plus, Pencil, KeyRound, Trash2, Loader2 } from "lucide-react";

interface StaffUserRow {
  _id: string;
  name: string;
  username: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const ROLE_BADGE: Record<StaffRole, string> = {
  cajero: "bg-brand-pink/10 text-brand-pink",
  mesero: "bg-brand-orange/10 text-brand-orange",
};
const ROLE_LABEL: Record<StaffRole, string> = { cajero: "Cajero", mesero: "Mesero" };

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl card-shadow p-8 text-center text-brand-dark/40">
      Todavía no hay usuarios. Creá el primero con Nuevo usuario.
    </div>
  );
}

export default function UsuariosPage() {
  useAdminSession();
  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [premiumError, setPremiumError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<StaffUserRow | null>(null);
  const [pinUser, setPinUser] = useState<StaffUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<StaffUserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [createForm, setCreateForm] = useState({ name: "", username: "", role: "cajero" as StaffRole, pin: "", pin2: "" });
  const [editForm, setEditForm] = useState({ name: "", role: "cajero" as StaffRole, active: true });
  const [pinForm, setPinForm] = useState({ pin: "", pin2: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/staff-users");
    const data = await res.json();
    if (res.status === 403) {
      setPremiumError(data.error ?? "Disponible en el plan Premium");
      setUsers([]);
    } else {
      setPremiumError("");
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setCreateForm({ name: "", username: "", role: "cajero", pin: "", pin2: "" });
    setFormError("");
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!/^\d{4}$/.test(createForm.pin)) {
      setFormError("El PIN debe tener exactamente 4 dígitos");
      return;
    }
    if (createForm.pin !== createForm.pin2) {
      setFormError("Los PIN no coinciden");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          username: createForm.username,
          role: createForm.role,
          pin: createForm.pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Error al crear el usuario");
        return;
      }
      setShowCreate(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: StaffUserRow) {
    setEditForm({ name: u.name, role: u.role, active: u.active });
    setFormError("");
    setEditUser(u);
  }

  async function handleEditSave() {
    if (!editUser) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/admin/staff-users/${editUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Error al guardar");
        return;
      }
      setEditUser(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function openPin(u: StaffUserRow) {
    setPinForm({ pin: "", pin2: "" });
    setFormError("");
    setPinUser(u);
  }

  async function handlePinSave() {
    if (!pinUser) return;
    if (!/^\d{4}$/.test(pinForm.pin)) {
      setFormError("El PIN debe tener exactamente 4 dígitos");
      return;
    }
    if (pinForm.pin !== pinForm.pin2) {
      setFormError("Los PIN no coinciden");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/admin/staff-users/${pinUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinForm.pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Error al cambiar el PIN");
        return;
      }
      setPinUser(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/staff-users/${deleteUser._id}`, { method: "DELETE" });
      setDeleteUser(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function digitsOnly4(value: string) {
    return value.replace(/\D/g, "").slice(0, 4);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Usuarios</h1>
          <p className="text-brand-dark/50 text-sm mt-1">Cajeros y meseros que entran al panel con usuario y PIN.</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nuevo usuario
        </Button>
      </div>

      {premiumError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          {premiumError}
        </div>
      )}

      {loading ? (
        <div className="text-brand-dark/40 text-sm">Cargando...</div>
      ) : !premiumError && (
        users.length === 0 ? <EmptyState /> : (
          <>
            {/* Desktop */}
            <div className="hidden md:block bg-white rounded-2xl card-shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-brand-dark/40 uppercase border-b border-brand-muted">
                    <th className="text-left px-5 py-3">Nombre</th>
                    <th className="text-left px-5 py-3">Usuario</th>
                    <th className="text-left px-5 py-3">Rol</th>
                    <th className="text-left px-5 py-3">Estado</th>
                    <th className="text-right px-5 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-b border-brand-muted/60 last:border-0">
                      <td className="px-5 py-3 font-medium text-brand-dark">{u.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-brand-dark/70">{u.username}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                          {u.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Editar" onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/50 hover:text-brand-dark transition-colors cursor-pointer">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button title="Cambiar PIN" onClick={() => openPin(u)} className="p-1.5 rounded-lg hover:bg-brand-muted text-brand-dark/50 hover:text-brand-dark transition-colors cursor-pointer">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button title="Eliminar" onClick={() => setDeleteUser(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-brand-dark/30 hover:text-red-500 transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {users.map((u) => (
                <div key={u._id} className="bg-white rounded-2xl card-shadow p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-dark truncate">{u.name}</p>
                      <p className="font-mono text-xs text-brand-dark/50">{u.username}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  </div>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${u.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                    {u.active ? "Activo" : "Inactivo"}
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openPin(u)}><KeyRound className="w-3.5 h-3.5 mr-1" /> PIN</Button>
                    <Button variant="ghost" size="sm" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setDeleteUser(u)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* Nuevo usuario */}
      <Dialog open={showCreate} onOpenChange={(v) => !v && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Nombre</label>
              <input
                type="text" maxLength={60} value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Usuario</label>
              <input
                type="text" autoCapitalize="none" value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
                className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink font-mono"
              />
              <p className="text-xs text-brand-dark/40 mt-1">3 a 20 caracteres: minúsculas, números, punto o guion bajo</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Rol</label>
              <div className="flex gap-2">
                {(["cajero", "mesero"] as StaffRole[]).map((r) => (
                  <button
                    key={r} type="button"
                    onClick={() => setCreateForm({ ...createForm, role: r })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                      createForm.role === r ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/60"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={createForm.pin}
                  onChange={(e) => setCreateForm({ ...createForm, pin: digitsOnly4(e.target.value) })}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Confirmar PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={createForm.pin2}
                  onChange={(e) => setCreateForm({ ...createForm, pin2: digitsOnly4(e.target.value) })}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
            </div>
            {formError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={saving} onClick={handleCreate}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar usuario */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Nombre</label>
              <input
                type="text" maxLength={60} value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Usuario</label>
              <input type="text" disabled value={editUser?.username ?? ""} className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm bg-brand-muted/30 text-brand-dark/50 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Rol</label>
              <div className="flex gap-2">
                {(["cajero", "mesero"] as StaffRole[]).map((r) => (
                  <button
                    key={r} type="button"
                    onClick={() => setEditForm({ ...editForm, role: r })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                      editForm.role === r ? "border-brand-pink bg-brand-pink/10 text-brand-pink" : "border-brand-muted text-brand-dark/60"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Estado</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditForm({ ...editForm, active: true })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${editForm.active ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-brand-muted text-brand-dark/60"}`}>
                  Activo
                </button>
                <button type="button" onClick={() => setEditForm({ ...editForm, active: false })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${!editForm.active ? "border-gray-400 bg-gray-100 text-gray-600" : "border-brand-muted text-brand-dark/60"}`}>
                  Inactivo
                </button>
              </div>
            </div>
            {formError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button className="flex-1" disabled={saving} onClick={handleEditSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cambiar PIN */}
      <Dialog open={!!pinUser} onOpenChange={(v) => !v && setPinUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4"><DialogTitle>Cambiar PIN</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinForm.pin}
                  onChange={(e) => setPinForm({ ...pinForm, pin: digitsOnly4(e.target.value) })}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Confirmar PIN</label>
                <input
                  type="password" inputMode="numeric" maxLength={4} value={pinForm.pin2}
                  onChange={(e) => setPinForm({ ...pinForm, pin2: digitsOnly4(e.target.value) })}
                  className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink"
                />
              </div>
            </div>
            <p className="text-xs text-brand-dark/40">El usuario no recibe aviso: comunicale el nuevo PIN.</p>
            {formError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setPinUser(null)}>Cancelar</Button>
              <Button className="flex-1" disabled={saving} onClick={handlePinSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eliminar usuario */}
      <Dialog open={!!deleteUser} onOpenChange={(v) => !v && setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2"><DialogTitle>¿Eliminar usuario?</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">Las ventas que registró conservan su nombre. Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100" disabled={saving} onClick={handleDelete}>Eliminar</Button>
              <Button variant="outline" className="flex-1" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
