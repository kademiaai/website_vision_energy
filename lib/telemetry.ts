type Payload = Record<string, any>;

export async function recordEvent(eventName: string, payload: Payload = {}) {
  try {
    const entry = {
      time: new Date().toISOString(),
      event: eventName,
      payload,
    };

    // Console for immediate visibility
    // eslint-disable-next-line no-console
    console.info('[telemetry]', JSON.stringify(entry));

    // Only attempt file I/O when running on the Node server (not in the browser).
    if (typeof window !== 'undefined') return;

    // Use a runtime import so bundlers don't try to resolve Node-only modules
    // at build time for client bundles.
    try {
      const fs = await import('fs');
      await fs.promises.mkdir('logs', { recursive: true }).catch(() => {});
      const line = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile('logs/telemetry.log', line, { encoding: 'utf8' });
    } catch (err) {
      // Best-effort: don't let telemetry file errors affect the app.
    }
  } catch (err) {
    // swallow errors; telemetry must not affect app flow
    // eslint-disable-next-line no-console
    console.warn('Telemetry error:', err);
  }
}

export default { recordEvent };
