export async function blastEventToRelays(event) {
    for (const relayUrl of blastRelays) {
      try {
        const socket = new WebSocket(relayUrl);
        socket.addEventListener("open", () => {
          const eventMessage = JSON.stringify(["EVENT", event]);
          socket.send(eventMessage);
          socket.close();
        });
        socket.addEventListener("error", (error) => {
          console.error(`Error blasting event to relay ${relayUrl}:`, error);
        });
      } catch (error) {
        console.error(`Error blasting event to relay ${relayUrl}:`, error);
      }
    }
  }