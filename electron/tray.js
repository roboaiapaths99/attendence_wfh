const { Tray, Menu, app } = require("electron");
const path = require("path");

let trayInstance = null;

function setupTray(mainWindow) {
  if (trayInstance) return trayInstance;

  // Use a fallback empty or standard dot template for development if icon assets are not yet compiled
  const iconPath = path.join(__dirname, "../public/favicon.ico");

  try {
    trayInstance = new Tray(iconPath);
  } catch (err) {
    // If favicon doesn't exist, we can use standard node process path
    const fallbackPath = path.join(app.getAppPath(), "public", "favicon.ico");
    try {
      trayInstance = new Tray(fallbackPath);
    } catch (e) {
      console.warn("Tray icon not loaded, running without custom system tray icon asset.");
      return null;
    }
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Status: Checked Out",
      enabled: false,
      id: "status-label"
    },
    { type: "separator" },
    {
      label: "Quit LogDay WFH",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  trayInstance.setToolTip("LogDay WFH Desktop Monitor");
  trayInstance.setContextMenu(contextMenu);

  trayInstance.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return trayInstance;
}

function updateTrayMenuStatus(status) {
  if (!trayInstance) return;
  
  let label = "Status: Unknown";
  if (status === "active") label = "Status: Checked In (Active)";
  else if (status === "idle") label = "Status: Idle";
  else if (status === "checked_out") label = "Status: Checked Out";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => {
        // App will open window
      }
    },
    { type: "separator" },
    {
      label: label,
      enabled: false,
      id: "status-label"
    },
    { type: "separator" },
    {
      label: "Quit LogDay WFH",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  trayInstance.setContextMenu(contextMenu);
}

module.exports = { setupTray, updateTrayMenuStatus };
