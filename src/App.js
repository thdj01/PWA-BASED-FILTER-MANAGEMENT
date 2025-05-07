import React, { useState, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  saveFilters,
  loadFilters,
  savePendingChanges,
  getPendingChanges,
  clearPendingChanges,
} from "./storage";
import "./App.css";

const DEMO_SERVER_DATA = [
  {
    id: 1,
    name: "Filter A",
    status: "OK",
    scheduleDate: "2025-05-12T12:15:23.794Z",
  },
  {
    id: 2,
    name: "Filter B",
    status: "Needs Replacement",
    scheduleDate: "2025-05-12T12:15:23.794Z",
  },
  {
    id: 3,
    name: "Filter C",
    status: "OK",
    scheduleDate: "2025-05-12T12:15:23.794Z",
  },
  {
    id: 4,
    name: "Filter D",
    status: "Needs Replacement",
    scheduleDate: "2025-05-12T12:15:23.794Z",
  },
];

function App() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);
  const [filters, setFilters] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [lastUpdated, setLastUpdated] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const videoRef = React.useRef(false);
  useEffect(() => {
    const loadData = async () => {
      const { filters: storedFilters, lastUpdated } = await loadFilters();
      if (storedFilters) {
        setFilters(storedFilters);
        setLastUpdated(lastUpdated);
      } else if (navigator.onLine) {
        setFilters(DEMO_SERVER_DATA);
        await saveFilters(DEMO_SERVER_DATA);
        setLastUpdated(new Date().toISOString());
      }
    };
    loadData();
  }, []);

  const startScan = async () => {
    setScanning(true);
    const codeReader = new BrowserMultiFormatReader();

    try {
      const result = await codeReader.decodeOnceFromVideoDevice(
        undefined,
        videoRef.current
      );
      setScanResult(result.getText());
      alert(`Scanned: ${result.getText()}`);

      const newFilter = {
        id: filters.length + 1,
        name: result.getText(),
        status: "OK",
      };
      const updated = [...filters, newFilter];
      setFilters(updated);
      await saveFilters(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to scan barcode");
    } finally {
      setScanning(false);
    }
  };
  const isInStandaloneMode = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  // PWA install logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      if (isInStandaloneMode()) return; // Prevent showing prompt if already installed
      e.preventDefault();
      console.log("beforeinstallprompt fired");
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log("PWA was installed");
      setDeferredPrompt(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(false);
  };

  // Initial load
  useEffect(() => {
    const saved = localStorage.getItem("filters");
    const timestamp = localStorage.getItem("lastUpdated");
    if (saved) {
      setFilters(JSON.parse(saved));
      setLastUpdated(timestamp);
    } else if (navigator.onLine) {
      setFilters(DEMO_SERVER_DATA);
      localStorage.setItem("filters", JSON.stringify(DEMO_SERVER_DATA));
      localStorage.setItem("lastUpdated", new Date().toISOString());
      setLastUpdated(new Date().toISOString());
    }
  }, []);

  // Online/offline tracking
  useEffect(() => {
    const syncData = async () => {
      const pending = await getPendingChanges();
      if (pending) {
        const saved = (await loadFilters()).filters || [];
        const merged = saved.map(
          (f) => pending.find((u) => u.id === f.id) || f
        );
        await saveFilters(merged);
        await clearPendingChanges();
        setFilters(merged);
        setLastUpdated(new Date().toISOString());
        alert("✅ Offline changes synced!");
      }
    };

    const goOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const toggleStatus = async (id) => {
    const updated = filters.map((filter) =>
      filter.id === id
        ? {
            ...filter,
            status: filter.status === "OK" ? "Needs Replacement" : "OK",
          }
        : filter
    );
    setFilters(updated);
    await saveFilters(updated);
    setLastUpdated(new Date().toISOString());

    if (!navigator.onLine) {
      await savePendingChanges(updated);
    }
  };
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        console.log("Service Worker registered", registration);
      });
    }
  }, []);

  const addFilter = async () => {
    if (!newFilterName.trim()) return;

    const newFilter = {
      id: Date.now(),
      name: newFilterName.trim(),
      status: "OK",
      scheduleDate: new Date(
        Date.now() + 6 * 24 * 60 * 60 * 1000
      ).toISOString(), // 7 days from now
    };

    const updated = [...filters, newFilter];
    setFilters(updated);
    await saveFilters(updated);
    setLastUpdated(new Date().toISOString());
    setNewFilterName("");

    try {
      await saveFilters(updated); // save locally
      if (!navigator.onLine) {
        await savePendingChanges(updated); // save to sync queue
      }
      setFilters(updated);
    } catch (err) {
      console.error("Error saving filters:", err);
    }
  };
  const sendNotification = async (title, body) => {
    if ("serviceWorker" in navigator && Notification.permission === "granted") {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.showNotification(title, {
          body,
          icon: "/icon-192.png", // optional
        });
      }
    }
  };
  const checkSchedule = () => {
    const today = new Date();

    filters.forEach((filter) => {
      if (!filter.scheduledDate) return;

      const dueDate = new Date(filter.scheduledDate);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      if ([6, 5, 4, 3, 2, 1].includes(diffDays)) {
        sendNotification(
          `Filter ${filter.name} Reminder`,
          `${diffDays} day(s) left until scheduled maintenance`
        );
      }
    });
  };

  // Run every day or interval (for demo, run every minute)
  useEffect(() => {
    const interval = setInterval(checkSchedule, 60 * 1000); // every 1 min
    return () => clearInterval(interval);
  }, [filters]);

  useEffect(() => {
    const checkSchedule = () => {
      const today = new Date();
      const alerts = [];

      filters.forEach((filter) => {
        if (!filter.scheduleDate) return;

        const schedule = new Date(filter.scheduleDate);
        const diffDays = Math.ceil((schedule - today) / (1000 * 60 * 60 * 24));

        if ([5, 4, 3, 2, 1].includes(diffDays)) {
          alerts.push(`${filter.name} is scheduled in ${diffDays} day(s)!`);
        }
      });
      alerts.forEach(async (msg) => {
        if (
          "serviceWorker" in navigator &&
          Notification.permission === "granted"
        ) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            registration.showNotification("⏰ Filter Reminder", {
              body: msg,
              icon: "/icon-192.png",
            });
          }
        } else {
          alert(msg); // fallback
        }
      });
    };

    // Ask for permission
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const interval = setInterval(checkSchedule, 1000 * 60 * 60); // every hour
    checkSchedule(); // also run on load

    return () => clearInterval(interval);
  }, [filters]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>🛠️ Filter Manager Demo (PWA)</h1>
      <p>
        Status:{" "}
        <strong style={{ color: isOnline ? "green" : "red" }}>
          {isOnline ? "Online" : "Offline"}
        </strong>
      </p>
      {lastUpdated && (
        <p>
          <em>Last Updated: {new Date(lastUpdated).toLocaleString()}</em>
        </p>
      )}

      {/* {deferredPrompt && !isInStandaloneMode() && (
        <div
          style={{
            padding: 16,
            marginBottom: 20,
            backgroundColor: "#f8f9fa",
            borderRadius: 8,
            border: "1px solid #dee2e6",
          }}
        >
          <p>Install this app on your device for offline use:</p>
          <button
            onClick={handleInstallClick}
            style={{
              backgroundColor: "#0d6efd",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Add to Home Screen
          </button>
        </div>
      )} */}

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Enter filter name"
          value={newFilterName}
          onChange={(e) => setNewFilterName(e.target.value)}
          style={{ padding: 8, marginRight: 8 }}
        />
        <button
          onClick={addFilter}
          style={{
            backgroundColor: "#198754",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: 4,
          }}
        >
          Add Filter
        </button>
      </div>

      <ul>
        {filters.map((filter) => (
          <li key={filter.id} style={{ marginBottom: 8 }}>
            <strong>{filter.name}</strong> — {filter.status}{" "}
            <button
              onClick={() => toggleStatus(filter.id)}
              style={{
                padding: "4px 10px",
                marginLeft: 10,
                cursor: "pointer",
              }}
            >
              Toggle
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 20 }}>
        <h2>Barcode Scanner</h2>
        <button
          onClick={startScan}
          disabled={scanning}
          style={{
            backgroundColor: "#198754",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {scanning ? "Scanning..." : "Scan Barcode"}
        </button>
        <div style={{ marginTop: 10 }}>
          <video ref={videoRef} style={{ width: "100%", maxWidth: 400 }} />
        </div>
        {scanResult && (
          <p>
            <strong>Last Scan:</strong> {scanResult}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
