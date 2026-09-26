const RealDate = Date;
const fixed = process.env.ADOMS_VERIFY_NOW;

if (fixed) {
  const instant = new RealDate(fixed);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid ADOMS_VERIFY_NOW: ${fixed}`);
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [instant.getTime()]));
    }
    static now() { return instant.getTime(); }
  };
}
