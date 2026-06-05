const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // System control handlers
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  
  // Tray status notifications
  updateTrayStatus: (status) => ipcRenderer.send("tray-status-update", status),
  sendNotification: (title, body) => ipcRenderer.send("show-notification", { title, body }),
  
  // Verification challenge events
  onVerificationTriggered: (callback) => {
    ipcRenderer.on("trigger-verification", (event, data) => callback(data));
  },
  
  // Clean up listeners
  removeVerificationListener: () => {
    ipcRenderer.removeAllListeners("trigger-verification");
  }
});
