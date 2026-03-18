/**
 * /api/blast — Pages Function that blasts an event to a chunk of relays.
 *
 * Receives POST { event, relays, authToken }
 * Returns  { success, failure, total, timedOut }
 *
 * Each invocation runs as a separate worker isolate, so the main handler
 * can dispatch many chunks in parallel without self-invocation issues.
 */

const BLAST_AUTH_TOKEN = "nosflare-blast-internal";

function blastToSingleRelay(event, relayUrl) {
  return new Promise((resolve) => {
    let socket;
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        resolve(false);
      }
    }, 1500);

    try {
      socket = new WebSocket(relayUrl);

      socket.addEventListener("open", () => {
        try {
          socket.send(JSON.stringify(["EVENT", event]));
          isResolved = true;
          clearTimeout(timeout);
          socket.close();
          resolve(true);
        } catch {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        }
      });

      socket.addEventListener("error", () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });

      socket.addEventListener("close", () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });
    } catch {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        resolve(false);
      }
    }
  });
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { event, relays, authToken } = await request.json();

    if (authToken !== BLAST_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!event || !relays || !Array.isArray(relays)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fire all relays in parallel — successful ones resolve instantly (open+send+close),
    // failed/unreachable ones hit the 1.5s individual timeout. No sequential batching needed.
    const results = await Promise.allSettled(
      relays.map((url) => blastToSingleRelay(event, url))
    );

    let successCount = 0;
    let failureCount = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value === true) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const result = "done";

    return new Response(
      JSON.stringify({
        success: successCount,
        failure: failureCount,
        total: relays.length,
        timedOut: result === "timeout",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
