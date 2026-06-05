const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { setupTray, updateTrayMenuStatus } = require("./tray.cjs");

let mainWindow = null;
let pythonProcess = null;

function startPythonAgent() {
  if (app.isPackaged) {
    // Path inside Electron's resources folder in production
    const agentPath = path.join(process.resourcesPath, "wfh-agent", "wfh-agent.exe");
    console.log("Spawning production WFH agent at:", agentPath);
    
    // Spawn detached so it lives independently
    pythonProcess = spawn(agentPath, [], {
      stdio: "ignore",
      detached: true
    });
    pythonProcess.unref();
  }
}

function stopPythonAgent() {
  if (pythonProcess) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", pythonProcess.pid, "/f", "/t"]);
      } else {
        pythonProcess.kill();
      }
    } catch (e) {
      console.error("Failed to terminate background agent:", e);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: "hiddenInset", // Sleek modern OS borderless styling
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  // Load the built files in production, or hit Vite dev server in local development
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5180");
  }

  // Prevent app from quitting on window close, minimize to tray instead
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Initialize System Tray
  setupTray(mainWindow);
}

app.whenReady().then(() => {
  startPythonAgent();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopPythonAgent();
    app.quit();
  }
});

app.on("will-quit", () => {
  stopPythonAgent();
});

// --- IPC EVENT HANDLERS ---

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on("tray-status-update", (event, status) => {
  updateTrayMenuStatus(status);
});

ipcMain.on("show-notification", (event, { title, body }) => {
  new Notification({
    title: title || "LogDay WFH Tracker",
    body: body || "Active session update"
  }).show();
});

