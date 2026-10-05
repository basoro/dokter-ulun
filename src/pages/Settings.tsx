import React from 'react';
import { BellRing, Eye, EyeOff, KeyRound, Phone, Save, ShieldCheck, Smartphone, Stethoscope, UserRound, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { API_URLS } from '@/config/api';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences
} from '@/lib/notification-preferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatGender = (value?: string) => {
  if (value === 'P') {
    return 'Perempuan';
  }

  return 'Laki-laki';
};

const Settings: React.FC = () => {
  const { user } = useAuth();
  const poliAccessDisplay = React.useMemo(() => {
    const poliSchedules = Array.isArray(user?.jadwal_poli) ? user.jadwal_poli : [];

    if (poliSchedules.length > 0) {
      return poliSchedules
        .map((poli) => {
          const code = String(poli?.kd_poli || '').trim();
          const name = String(poli?.nm_poli || '').trim();

          if (code && name) {
            return `${code} - ${name}`;
          }

          return code || name;
        })
        .filter(Boolean)
        .join(', ');
    }

    if (Array.isArray(user?.all_poli) && user.all_poli.length > 0) {
      return user.all_poli.join(', ');
    }

    return user?.kd_poli || '-';
  }, [user]);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = React.useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [preferences, setPreferences] = React.useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [canManageSsrmeButton, setCanManageSsrmeButton] = React.useState(false);
  const [ssrmeButtonEnabled, setSsrmeButtonEnabled] = React.useState(false);
  const [ssrmeButtonSettingsLoaded, setSsrmeButtonSettingsLoaded] = React.useState(false);
  const [savingSsrmeButton, setSavingSsrmeButton] = React.useState(false);
  const [canManageAlertKronis, setCanManageAlertKronis] = React.useState(false);
  const [alertKronisEnabled, setAlertKronisEnabled] = React.useState(false);
  const [alertKronisSettingsLoaded, setAlertKronisSettingsLoaded] = React.useState(false);
  const [savingAlertKronis, setSavingAlertKronis] = React.useState(false);

  React.useEffect(() => {
    setPreferences(loadNotificationPreferences());
  }, []);

  React.useEffect(() => {
    if (!user?.username) {
      return;
    }

    let isActive = true;
    setSsrmeButtonSettingsLoaded(false);

    const loadSsrmeButtonSettings = async () => {
      try {
        const response = await fetch(
          `${API_URLS.SATU_SEHAT_BUTTON_SETTING}?username=${encodeURIComponent(user.username)}`
        );
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Gagal memuat pengaturan Satu Sehat.');
        }

        if (isActive) {
          setCanManageSsrmeButton(Boolean(result.can_manage));
          setSsrmeButtonEnabled(Boolean(result.enabled));
        }
      } catch (error) {
        if (isActive) {
          setCanManageSsrmeButton(false);
          toast.error(error instanceof Error ? error.message : 'Gagal memuat pengaturan Satu Sehat.');
        }
      } finally {
        if (isActive) {
          setSsrmeButtonSettingsLoaded(true);
        }
      }
    };

    void loadSsrmeButtonSettings();
    return () => {
      isActive = false;
    };
  }, [user?.username]);

  React.useEffect(() => {
    if (!user?.username) {
      return;
    }

    let isActive = true;
    setAlertKronisSettingsLoaded(false);

    const loadAlertKronisSettings = async () => {
      try {
        const response = await fetch(
          `${API_URLS.ALERT_KRONIS_SETTING}?username=${encodeURIComponent(user.username)}`
        );
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Gagal memuat pengaturan Alert Obat Kronis.');
        }

        if (isActive) {
          setCanManageAlertKronis(Boolean(result.can_manage));
          setAlertKronisEnabled(Boolean(result.enabled));
        }
      } catch (error) {
        if (isActive) {
          setCanManageAlertKronis(false);
          toast.error(error instanceof Error ? error.message : 'Gagal memuat pengaturan Alert Obat Kronis.');
        }
      } finally {
        if (isActive) {
          setAlertKronisSettingsLoaded(true);
        }
      }
    };

    void loadAlertKronisSettings();
    return () => {
      isActive = false;
    };
  }, [user?.username]);

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const nextPreferences = {
      ...preferences,
      [key]: value
    };

    setPreferences(nextPreferences);
    saveNotificationPreferences(nextPreferences);
    toast.success('Pengaturan notifikasi diperbarui');
  };

  const handleSsrmeButtonChange = async (enabled: boolean) => {
    if (!user?.username) {
      return;
    }

    try {
      setSavingSsrmeButton(true);
      const response = await fetch(API_URLS.SATU_SEHAT_BUTTON_SETTING, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, value: enabled ? 'on' : 'off' })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Gagal menyimpan pengaturan Satu Sehat.');
      }

      setSsrmeButtonEnabled(Boolean(result.enabled));
      toast.success('Pengaturan Satu Sehat Rekam Medis berhasil disimpan.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan Satu Sehat.');
    } finally {
      setSavingSsrmeButton(false);
    }
  };

  const handleAlertKronisChange = async (enabled: boolean) => {
    if (!user?.username) {
      return;
    }

    try {
      setSavingAlertKronis(true);
      const response = await fetch(API_URLS.ALERT_KRONIS_SETTING, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, value: enabled ? 'on' : 'off' })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Gagal menyimpan pengaturan Alert Obat Kronis.');
      }

      setAlertKronisEnabled(Boolean(result.enabled));
      toast.success('Pengaturan Alert Obat Kronis berhasil disimpan.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan Alert Obat Kronis.');
    } finally {
      setSavingAlertKronis(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.username) {
      toast.error('Data pengguna tidak ditemukan');
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Semua field password wajib diisi');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok');
      return;
    }

    try {
      setSavingPassword(true);
      const response = await fetch(`${API_URLS.AUTH}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const responseJson = await response.json();

      if (!response.ok || !responseJson?.success) {
        throw new Error(responseJson?.error || `HTTP error ${response.status}`);
      }

      toast.success(responseJson?.message || 'Password berhasil diperbarui');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto w-full animate-fade-in space-y-6 rounded-md bg-white p-2 shadow-md transition-colors dark:bg-slate-950 dark:shadow-slate-950/40 md:space-y-8 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola profil singkat dokter, keamanan akun, dan preferensi notifikasi.
        </p>
      </div>

      <Tabs defaultValue="profil" className="w-full">
        <TabsList className={`grid h-auto w-full grid-cols-2 gap-2 p-1 ${canManageSsrmeButton || (canManageAlertKronis && alertKronisSettingsLoaded) ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <TabsTrigger value="profil" className="gap-2">
            <UserRound className="h-4 w-4" />
            Profil
          </TabsTrigger>            <TabsTrigger value="umum" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Umum
          </TabsTrigger>
          <TabsTrigger value="keamanan" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Keamanan Login
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Ganti Password
          </TabsTrigger>
          <TabsTrigger value="notifikasi" className="gap-2">
            <BellRing className="h-4 w-4" />
            Notifikasi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserRound className="h-5 w-5 text-primary" />
                Profil Singkat Dokter
              </CardTitle>
              <CardDescription>
                Informasi akun dokter yang aktif pada sesi saat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Nama Dokter</p>
                  <p className="mt-1 font-medium">{user?.name || '-'}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Kode Dokter</p>
                  <p className="mt-1 font-medium">{user?.username || '-'}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Jenis Kelamin</p>
                  <p className="mt-1 font-medium">{formatGender(user?.jk)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="mt-1 font-medium uppercase">{user?.role || '-'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <Phone className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nomor Telepon</p>
                    <p className="mt-1 font-medium">{user?.no_telp || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <Stethoscope className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Poli Akses</p>
                    <p className="mt-1 font-medium">{poliAccessDisplay}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keamanan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Keamanan Login
              </CardTitle>
              <CardDescription>
                Atur verifikasi OTP WhatsApp saat proses login aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>OTP Saat Login</AlertTitle>
                <AlertDescription>
                  Jika aktif, login akan meminta verifikasi OTP WhatsApp sebelum masuk ke aplikasi.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Aktifkan OTP Saat Login</p>
                  <p className="text-sm text-muted-foreground">
                    Nonaktifkan jika Anda ingin login langsung hanya dengan username dan password di perangkat ini.
                  </p>
                </div>
                <Switch
                  checked={preferences.otpLogin}
                  onCheckedChange={(checked) => handlePreferenceChange('otpLogin', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <KeyRound className="h-5 w-5 text-primary" />
                Ganti Password
              </CardTitle>
              <CardDescription>
                Ubah password akun dokter untuk keamanan akses aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Password Lama</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword.currentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
                      placeholder="Masukkan password lama"
                      className="pr-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowPassword((previous) => ({ ...previous, currentPassword: !previous.currentPassword }))}
                      aria-label={showPassword.currentPassword ? 'Sembunyikan password lama' : 'Tampilkan password lama'}
                    >
                      {showPassword.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Password Baru</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword.newPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
                      placeholder="Minimal 6 karakter"
                      className="pr-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowPassword((previous) => ({ ...previous, newPassword: !previous.newPassword }))}
                      aria-label={showPassword.newPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                    >
                      {showPassword.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword.confirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                      placeholder="Ulangi password baru"
                      className="pr-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowPassword((previous) => ({ ...previous, confirmPassword: !previous.confirmPassword }))}
                      aria-label={showPassword.confirmPassword ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'}
                    >
                      {showPassword.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" disabled={savingPassword} className="w-full">
                  <Save className="h-4 w-4" />
                  {savingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifikasi">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BellRing className="h-5 w-5 text-primary" />
                Pengaturan Notifikasi
              </CardTitle>
              <CardDescription>
                Aktifkan atau nonaktifkan kategori notifikasi yang ingin dipantau.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Disimpan Lokal</AlertTitle>
                <AlertDescription>
                  Preferensi notifikasi disimpan di browser perangkat ini melalui `localStorage`.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Notifikasi Resep</p>
                    <p className="text-sm text-muted-foreground">
                      Tampilkan proses peresepan pada badge, dropdown, dan alert.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.prescription}
                    onCheckedChange={(checked) => handlePreferenceChange('prescription', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Notifikasi Laboratorium</p>
                    <p className="text-sm text-muted-foreground">
                      Tampilkan proses dan hasil laboratorium yang siap dibaca.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.laboratory}
                    onCheckedChange={(checked) => handlePreferenceChange('laboratory', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Notifikasi Radiologi</p>
                    <p className="text-sm text-muted-foreground">
                      Tampilkan proses dan hasil radiologi yang siap dibaca.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.radiology}
                    onCheckedChange={(checked) => handlePreferenceChange('radiology', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Notifikasi Automatic Stop Order</p>
                    <p className="text-sm text-muted-foreground">
                      Tampilkan pemberitahuan ketika obat pasien mendapat automatic stop order.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.auto_stop_order}
                    onCheckedChange={(checked) => handlePreferenceChange('auto_stop_order', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Suara Alert</p>
                    <p className="text-sm text-muted-foreground">
                      Putar bunyi saat ada pembaruan proses atau hasil pemeriksaan baru.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.sound}
                    onCheckedChange={(checked) => handlePreferenceChange('sound', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageSsrmeButton && (
          <TabsContent value="umum">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <SettingsIcon className="h-5 w-5 text-primary" />
                  Pengaturan Umum
                </CardTitle>
                <CardDescription>
                  Atur fitur sistem yang sering digunakan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Satu Sehat Rekam Medis</p>
                    <p className="text-sm text-muted-foreground">
                      Aktifkan tombol Satu Sehat untuk rekam medis pasien.
                    </p>
                  </div>
                  <Switch
                    id="ssrme-button-toggle"
                    checked={ssrmeButtonEnabled}
                    onCheckedChange={(checked) => void handleSsrmeButtonChange(checked)}
                    disabled={savingSsrmeButton}
                    aria-label="Satu Sehat Rekam Medis ON | OFF"
                  />
                </div>

                {canManageAlertKronis && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Alert Obat Kronis</p>
                      <p className="text-sm text-muted-foreground">
                        Aktifkan atau nonaktifkan fitur alert untuk obat kronis per item obat.
                      </p>
                    </div>
                    <Switch
                      id="alert-kronis-toggle"
                      checked={alertKronisEnabled}
                      onCheckedChange={(checked) => void handleAlertKronisChange(checked)}
                      disabled={savingAlertKronis}
                      aria-label="Alert Obat Kronis ON | OFF"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
