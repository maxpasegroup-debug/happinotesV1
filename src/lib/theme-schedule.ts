/** Day/night appearance follows the device's local clock, without location access. */
export function isNightTime(now = new Date()) {
  return now.getHours() < 6 || now.getHours() >= 18;
}
