type HttpFailure = { status?: number; message?: string };

function failure(error: unknown): HttpFailure {
  return error && typeof error === 'object' ? error as HttpFailure : {};
}

export function isExpiredDeletionSession(error: unknown): boolean {
  const { status, message } = failure(error);
  return status === 401 && (message === 'Invalid or expired token' || message === 'User not found');
}

/** Support older servers without confusing a missing request with a dead session. */
export async function readDeletionStatus<T>(load: () => Promise<T>, verifySession: () => Promise<void>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    const { status, message } = failure(error);
    if ((status === 401 || status === 404) && message === 'Deletion request not found') return null;
    if (status === 401) {
      // Read-only verification: never clear credentials or submit a request here.
      await verifySession();
      if (message === 'Account deletion is no longer available') return null;
      throw new Error('Your session is active, but deletion status could not be checked. Please try again or contact support.');
    }
    throw error;
  }
}
