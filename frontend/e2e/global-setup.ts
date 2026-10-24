import { request, type FullConfig } from '@playwright/test';

/** Comprueba que la API responde antes de empezar, con un mensaje claro si no está levantada. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]!.use.baseURL!;
  const api = await request.newContext({ baseURL });
  try {
    const response = await api.get('/api/courses');
    if (response.status() !== 401) {
      throw new Error(`Respuesta inesperada de /api/courses: ${response.status()}`);
    }
  } catch (error) {
    throw new Error(
      `La API no responde en ${baseURL}/api. Levanta el stack (docker compose up -d --build) ` +
        `o el backend + npm start antes de los E2E.\n${String(error)}`,
    );
  } finally {
    await api.dispose();
  }
}
