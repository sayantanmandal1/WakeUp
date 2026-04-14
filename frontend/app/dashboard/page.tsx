"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  Trash2,
  Power,
  PowerOff,
  LogOut,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  isAuthenticated,
  clearToken,
  getWebsites,
  addWebsite,
  deleteWebsite,
  toggleWebsite,
  Website,
} from "@/lib/api";
import { toast } from "sonner";

export default function DashboardPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const fetchWebsites = useCallback(async () => {
    try {
      const data = await getWebsites();
      setWebsites(data);
    } catch {
      toast.error("Failed to fetch websites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    fetchWebsites();
  }, [router, fetchWebsites]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    try {
      const website = await addWebsite(url.trim());
      setWebsites((prev) => [website, ...prev]);
      setUrl("");
      toast.success("Website added — pinging starts in ~30s");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWebsite(id);
      setWebsites((prev) => prev.filter((w) => w.id !== id));
      toast.success("Website removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const result = await toggleWebsite(id);
      setWebsites((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: result.status } : w))
      );
      toast.success(
        result.status === "active" ? "Pinging resumed" : "Pinging paused"
      );
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const handleLogout = () => {
    clearToken();
    router.push("/");
  };

  const activeCount = websites.filter((w) => w.status === "active").length;

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/3 blur-3xl"
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/2 blur-3xl"
          animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 border border-white/10">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">WakeUp</h1>
              <p className="text-xs text-white/40">
                {activeCount} active · {websites.length} total
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/40 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {/* Add website form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <form onSubmit={handleAdd} className="flex gap-3 mb-8">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                type="text"
                placeholder="Enter website URL (e.g. my-api.onrender.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/30 focus:ring-white/10 h-11 pl-10"
              />
            </div>
            <Button
              type="submit"
              disabled={adding || !url.trim()}
              className="h-11 bg-white text-black hover:bg-white/90 font-semibold px-6 cursor-pointer"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add
                </>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Website list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : websites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="inline-flex p-4 rounded-full bg-white/5 border border-white/10 mb-4">
              <Globe className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-sm">
              No websites yet. Add one above to keep it alive!
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {websites.map((site, index) => (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.07] transition-colors"
                >
                  {/* Status indicator */}
                  <div className="relative">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        site.status === "active"
                          ? "bg-emerald-400"
                          : "bg-white/20"
                      }`}
                    />
                    {site.status === "active" && (
                      <motion.div
                        className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400"
                        animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* URL */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {site.url}
                    </p>
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant={
                      site.status === "active" ? "default" : "secondary"
                    }
                    className={`text-xs ${
                      site.status === "active"
                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                        : "bg-white/5 text-white/40 border-white/10"
                    }`}
                  >
                    {site.status === "active" ? "Pinging" : "Paused"}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(site.id)}
                      className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/10 cursor-pointer"
                      title={
                        site.status === "active"
                          ? "Pause pinging"
                          : "Resume pinging"
                      }
                    >
                      {site.status === "active" ? (
                        <PowerOff className="w-3.5 h-3.5" />
                      ) : (
                        <Power className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(site.id)}
                      className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
                      title="Remove website"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-white/20 mt-12"
        >
          Active websites are pinged with a GET request every 30 seconds
        </motion.p>
      </main>
    </div>
  );
}
