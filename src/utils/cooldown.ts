export class Cooldown {
  private readonly lastUseByUser = new Map<string, number>();

  constructor(private readonly cooldownMs: number) {}

  canRun(userId: string): boolean {
    const now = Date.now();
    const lastUse = this.lastUseByUser.get(userId) ?? 0;
    if (now - lastUse < this.cooldownMs) {
      return false;
    }

    this.lastUseByUser.set(userId, now);
    return true;
  }
}
