export function readHookInput(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let settled = false;
    let input = "";

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(input.replace(/^\uFEFF/, "") || "{}"));
      } catch {
        resolve({});
      }
    };

    const timer = setTimeout(finish, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      if (input.length < 2_000_000) input += chunk;
    });
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
    if (process.stdin.readableEnded) finish();
  });
}

export function writeJson(value) {
  process.stdout.write(JSON.stringify(value));
}
