export async function register() {
  const fixed = process.env.ADOMS_VERIFY_NOW;
  if (!fixed) return;

  const RealDate = Date;
  const instant = new RealDate(fixed);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("ADOMS_VERIFY_NOW must be a valid timestamp");
  }

  const FrozenDate = new Proxy(RealDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [instant.getTime()]);
    },
  });
  Object.defineProperty(FrozenDate, "now", { value: () => instant.getTime() });
  global.Date = FrozenDate;
}
