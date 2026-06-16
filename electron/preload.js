const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  sendGesture: (payload) => ipcRenderer.send("gesture-event", payload),
  sendVoiceCommand: (payload) => ipcRenderer.send("voice-command", payload),
});
