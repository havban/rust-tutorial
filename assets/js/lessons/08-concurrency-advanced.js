import { md } from "./_util.js";

export default {
  id: "concurrency-advanced",
  n: 8,
  title: "Concurrency, async & beyond",
  summary:
    "Threads, channels and shared state; async/await; then modules, testing, macros and unsafe.",
  lessons: [
    {
      slug: "threads",
      title: "Threads",
      summary:
        "Spawning OS threads, joining them, and why `move` is almost always required.",
      tags: ["thread::spawn", "join", "move", "Send"],
      body: md(
        "`std::thread::spawn` starts a real OS thread and returns a `JoinHandle`. Calling `.join()` waits for it and gives you its return value as a `Result` — `Err` if the thread panicked.",
        "",
        "```rust",
        "let handle = thread::spawn(|| 2 + 2);",
        "println!(\"{}\", handle.join().unwrap());",
        "```",
        "",
        "If you do not join, the thread is detached and dies when `main` returns, possibly mid-work.",
        "",
        "## Why `move`",
        "",
        "A spawned thread may outlive the scope that created it, so it cannot hold a borrow of a local. The closure must own what it uses — hence `thread::spawn(move || ...)`. The compiler enforces this with a `'static` bound on the closure, and the error message tells you to add `move`.",
        "",
        "If several threads need the same data, clone an `Arc` per thread.",
        "",
        "## Fearless concurrency, concretely",
        "",
        "Two marker traits do the work, and both are inferred:",
        "",
        "- **`Send`** — safe to transfer ownership to another thread. Almost everything is; `Rc<T>` is not, because its counter is not atomic.",
        "- **`Sync`** — safe to share `&T` across threads. `RefCell<T>` is not, because its borrow flag is not atomic.",
        "",
        "So the mistake of sending an `Rc` between threads is a *compile* error. This is the same borrow checker you have been using since module 3 — data races are just aliasing bugs, and it already rules those out.",
        "",
        "## Scoped threads",
        "",
        "`thread::scope` lets threads borrow local data, because the scope guarantees they all finish before it returns. No `Arc`, no `move`, no `'static`.",
      ),
      code: `use std::thread;
use std::time::Duration;

fn main() {
    // A thread that returns a value.
    let handle = thread::spawn(|| {
        let mut total = 0u64;
        for i in 1..=1_000 {
            total += i;
        }
        total
    });
    println!("sum from the worker: {}", handle.join().unwrap());

    // move is required: the closure must own what it uses.
    let data = vec![1, 2, 3];
    let handle = thread::spawn(move || {
        println!("worker owns {data:?}, sum {}", data.iter().sum::<i32>());
        data.len()
    });
    println!("worker saw {} items", handle.join().unwrap());

    // Several threads, collected handles, deterministic results.
    let handles: Vec<_> = (1..=4)
        .map(|id| {
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(10 * (5 - id) as u64));
                format!("thread {id} finished")
            })
        })
        .collect();

    for h in handles {
        println!("{}", h.join().unwrap());
    }

    // Threads run concurrently; interleaving is not deterministic, so we
    // collect results rather than relying on print order.
    let squares: Vec<u64> = (1..=8u64)
        .map(|n| thread::spawn(move || n * n))
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();
    println!("squares computed in parallel: {squares:?}");

    // A panicking thread does not take the process down; join reports it.
    let bad = thread::spawn(|| {
        panic!("worker gave up");
    });
    println!("worker panicked? {}", bad.join().is_err());

    // Scoped threads may borrow locals: the scope waits for them all.
    let numbers = vec![10, 20, 30, 40];
    let (left, right) = numbers.split_at(2);
    let (a, b) = thread::scope(|s| {
        let h1 = s.spawn(|| left.iter().sum::<i32>());
        let h2 = s.spawn(|| right.iter().sum::<i32>());
        (h1.join().unwrap(), h2.join().unwrap())
    });
    println!("halves {a} + {b} = {}", a + b);
    println!("numbers still borrowable here: {numbers:?}");

    // Send/Sync are what make the above safe. Rc is deliberately not Send:
    //
    //     let rc = std::rc::Rc::new(1);
    //     thread::spawn(move || println!("{rc}")); // compile error
    //
    // Uncomment those two lines to read the error for yourself.

    println!("available parallelism: {:?}", thread::available_parallelism());
}`,
      exercise: {
        prompt:
          "Spawn two threads that each return a number (say 20 and 22), join both, and print their total as `total: 42`.",
        expect: { contains: ["total: 42"], sourceContains: ["spawn"] },
        hint: "`let a = thread::spawn(|| 20); let b = thread::spawn(|| 22); println!(\"total: {}\", a.join().unwrap() + b.join().unwrap());`",
      },
    },

    {
      slug: "channels",
      title: "Channels",
      summary:
        "Message passing with `mpsc` — the easiest concurrency to reason about.",
      tags: ["mpsc", "channel", "Sender", "Receiver"],
      body: md(
        "A channel moves values between threads. Ownership transfers with the message, so there is nothing left to race over — \"do not communicate by sharing memory; share memory by communicating\".",
        "",
        "```rust",
        "let (tx, rx) = mpsc::channel();",
        "thread::spawn(move || tx.send(42).unwrap());",
        "println!(\"{}\", rx.recv().unwrap());",
        "```",
        "",
        "`mpsc` is **multiple producer, single consumer**: clone the `Sender` as many times as you need, but there is one `Receiver`.",
        "",
        "## Receiving",
        "",
        "- `recv()` blocks until a message arrives. Returns `Err` once every sender has been dropped — that is how you detect the end of the stream.",
        "- `try_recv()` returns immediately, `Err` if nothing is waiting.",
        "- `recv_timeout(d)` waits with a deadline.",
        "- **Iterating the receiver** (`for msg in rx`) is the idiomatic form: it yields messages until the channel closes.",
        "",
        "That last point has a trap: the loop only ends when *all* senders are dropped. If you clone `tx` and keep the original alive in `main`, the loop hangs forever. Either `drop(tx)` explicitly or make sure every clone is moved into a thread.",
        "",
        "## Flavours",
        "",
        "- `channel()` is asynchronous and unbounded — `send` never blocks.",
        "- `sync_channel(n)` is bounded — `send` blocks when `n` messages are in flight, giving you backpressure.",
        "",
        "> For heavier work — multiple consumers, `select` across channels — the `crossbeam-channel` crate is the usual choice.",
      ),
      code: `use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    // One message, one direction.
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        tx.send(String::from("hello from a thread")).unwrap();
    });
    println!("received: {}", rx.recv().unwrap());

    // A stream of messages: iterate until the channel closes.
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        for i in 1..=5 {
            tx.send(i * i).unwrap();
            thread::sleep(Duration::from_millis(5));
        }
        // tx is dropped here, which ends the loop below.
    });
    let collected: Vec<i32> = rx.iter().collect();
    println!("stream: {collected:?}");

    // Multiple producers: clone the Sender, one per worker.
    let (tx, rx) = mpsc::channel();
    for id in 1..=3 {
        let tx = tx.clone();
        thread::spawn(move || {
            for n in 1..=3 {
                tx.send(format!("worker {id} message {n}")).unwrap();
            }
        });
    }
    // Crucial: drop the original, or the receiver never sees the end.
    drop(tx);

    let mut messages: Vec<String> = rx.iter().collect();
    messages.sort();
    println!("{} messages from 3 workers:", messages.len());
    for m in &messages {
        println!("  {m}");
    }

    // try_recv: poll without blocking.
    let (tx, rx) = mpsc::channel::<i32>();
    println!("nothing yet? {:?}", rx.try_recv().is_err());
    tx.send(7).unwrap();
    println!("now: {:?}", rx.try_recv());

    // recv_timeout: give up after a while.
    let (_tx, rx) = mpsc::channel::<i32>();
    let waited = rx.recv_timeout(Duration::from_millis(20));
    println!("timed out as expected? {}", waited.is_err());

    // A bounded channel applies backpressure.
    let (tx, rx) = mpsc::sync_channel(2);
    let producer = thread::spawn(move || {
        for i in 1..=5 {
            tx.send(i).unwrap();
            println!("  sent {i}");
        }
    });
    thread::sleep(Duration::from_millis(20));
    let total: i32 = rx.iter().sum();
    producer.join().unwrap();
    println!("bounded channel total: {total}");

    // A small pipeline: produce -> transform -> consume.
    let (raw_tx, raw_rx) = mpsc::channel();
    let (done_tx, done_rx) = mpsc::channel();

    thread::spawn(move || {
        for word in ["alpha", "beta", "gamma"] {
            raw_tx.send(word.to_string()).unwrap();
        }
    });

    thread::spawn(move || {
        for word in raw_rx {
            done_tx.send(word.to_uppercase()).unwrap();
        }
    });

    let mut out: Vec<String> = done_rx.iter().collect();
    out.sort();
    println!("pipeline output: {out:?}");
}`,
      exercise: {
        prompt:
          "Create a channel, spawn a thread that sends the numbers 1 through 4, and sum them on the receiving side by iterating the receiver. Print `sum: 10`.",
        expect: { contains: ["sum: 10"], sourceContains: ["channel"] },
        hint: "Move `tx` into the thread so it drops when the thread ends, then `let sum: i32 = rx.iter().sum();`",
      },
    },

    {
      slug: "shared-state",
      title: "Arc and Mutex",
      summary:
        "Shared mutable state across threads, with the lock built into the type.",
      tags: ["Arc", "Mutex", "RwLock", "atomic"],
      body: md(
        "When message passing does not fit — a counter every thread increments, a cache every thread reads — you share state. Two types do it:",
        "",
        "- **`Arc<T>`** — atomically reference-counted. Like `Rc`, but the count is updated atomically so it is `Send`. Slightly slower than `Rc`; use `Rc` when single-threaded.",
        "- **`Mutex<T>`** — mutual exclusion. Note that the data lives **inside** the mutex, which is the key design choice.",
        "",
        "```rust",
        "let counter = Arc::new(Mutex::new(0));",
        "let c = Arc::clone(&counter);",
        "thread::spawn(move || { *c.lock().unwrap() += 1; });",
        "```",
        "",
        "## Why wrapping the data matters",
        "",
        "In C a mutex sits *next to* the data it protects, and nothing stops you reading the data without taking the lock. In Rust the only way to reach the value is through `lock()`, so forgetting to lock is not expressible.",
        "",
        "`lock()` returns a `MutexGuard`, which derefs to the data and **releases the lock when dropped**. So the lock is held exactly as long as the guard's scope — RAII again, from lesson 7.7. It returns a `Result` because the lock is *poisoned* if a thread panicked while holding it.",
        "",
        "## Deadlock is still possible",
        "",
        "Rust prevents data races, not deadlocks. Two threads taking two locks in opposite orders will still hang. Keep critical sections short, and always take locks in a consistent order.",
        "",
        "## The alternatives",
        "",
        "- **`RwLock<T>`** — many concurrent readers, or one writer. Worth it when reads dominate.",
        "- **Atomics** (`AtomicUsize` and friends) — lock-free operations on a single integer. Much faster for a simple counter.",
      ),
      code: `use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;

fn main() {
    // --- Arc<Mutex<T>>: the workhorse ---
    let counter = Arc::new(Mutex::new(0));
    let mut handles = Vec::new();

    for _ in 0..8 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            for _ in 0..1_000 {
                let mut guard = counter.lock().unwrap();
                *guard += 1;
            } // the guard drops each pass, releasing the lock
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("8 threads x 1000 increments = {}", *counter.lock().unwrap());

    // Sharing a whole collection.
    let log = Arc::new(Mutex::new(Vec::<String>::new()));
    let mut handles = Vec::new();
    for id in 0..4 {
        let log = Arc::clone(&log);
        handles.push(thread::spawn(move || {
            log.lock().unwrap().push(format!("thread {id} reporting"));
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    let mut entries = log.lock().unwrap().clone();
    entries.sort();
    println!("log has {} entries, first is {:?}", entries.len(), entries[0]);

    // Keep critical sections short: compute outside, lock briefly.
    let results = Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();
    for n in 1..=4u64 {
        let results = Arc::clone(&results);
        handles.push(thread::spawn(move || {
            let heavy = (1..=n * 1000).sum::<u64>(); // outside the lock
            results.lock().unwrap().push((n, heavy));
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    let mut rs = results.lock().unwrap().clone();
    rs.sort();
    println!("computed {rs:?}");

    // --- RwLock: many readers, one writer ---
    let config = Arc::new(RwLock::new(vec!["default".to_string()]));
    let readers: Vec<_> = (0..3)
        .map(|id| {
            let config = Arc::clone(&config);
            thread::spawn(move || {
                let guard = config.read().unwrap();
                format!("reader {id} saw {} entries", guard.len())
            })
        })
        .collect();
    for r in readers {
        println!("{}", r.join().unwrap());
    }
    config.write().unwrap().push("override".to_string());
    println!("after write: {:?}", config.read().unwrap());

    // --- Atomics: lock-free, and much cheaper for one integer ---
    let hits = Arc::new(AtomicUsize::new(0));
    let mut handles = Vec::new();
    for _ in 0..8 {
        let hits = Arc::clone(&hits);
        handles.push(thread::spawn(move || {
            for _ in 0..1_000 {
                hits.fetch_add(1, Ordering::Relaxed);
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("atomic counter: {}", hits.load(Ordering::Relaxed));

    // Poisoning: a panic while holding the lock marks it for everyone.
    let fragile = Arc::new(Mutex::new(0));
    let f = Arc::clone(&fragile);
    let _ = thread::spawn(move || {
        let _guard = f.lock().unwrap();
        panic!("died holding the lock");
    })
    .join();
    println!("lock poisoned? {}", fragile.lock().is_err());
    // The data is still recoverable if you decide it is consistent.
    // Bind the result rather than matching inline: the guard is a temporary
    // that must not outlive the mutex it borrows.
    let recovered = fragile.lock();
    match recovered {
        Ok(value) => println!("lock was clean after all: {value}"),
        Err(poisoned) => println!("recovered value anyway: {}", poisoned.into_inner()),
    }
}`,
      exercise: {
        prompt:
          "Use `Arc<Mutex<i32>>` and 4 threads that each add 10, then print `final: 40`.",
        expect: { contains: ["final: 40"], sourceContains: ["Mutex"] },
        hint: "Clone the `Arc` into each thread, `*c.lock().unwrap() += 10;`, join all handles, then print `*counter.lock().unwrap()`.",
      },
    },

    {
      slug: "async-await",
      title: "async / await",
      summary:
        "Concurrency without threads — futures, the executor, and when async is the right tool.",
      tags: ["async", "await", "Future", "tokio"],
      body: md(
        "Threads are the right tool for CPU-bound work. For **IO-bound** work — ten thousand sockets mostly sitting idle — one OS thread each is far too expensive. That is what async is for.",
        "",
        "```rust",
        "async fn fetch(id: u32) -> String { ... }",
        "let page = fetch(1).await;",
        "```",
        "",
        "## What `async` actually does",
        "",
        "An `async fn` does not run when called. It returns a **`Future`**: a state machine the compiler generates from your function body. Nothing happens until something *polls* it — futures in Rust are lazy, unlike JavaScript promises which start immediately.",
        "",
        "`.await` means \"poll this future; if it is not ready, yield control so the executor can run something else, and resume here when it is\". Each `.await` is a suspension point where the generated state machine can pause.",
        "",
        "## You need an executor",
        "",
        "The standard library defines `Future` but ships no runtime, so you pick one: **tokio** (dominant), async-std, or smol. `#[tokio::main]` wraps your `main` in a runtime.",
        "",
        "## Running things concurrently",
        "",
        "Sequential `a.await; b.await;` does one then the other. For actual concurrency:",
        "",
        "- `join!(a, b)` — run both, wait for both.",
        "- `select!` — whichever finishes first.",
        "- `tokio::spawn` — hand a task to the runtime, like a thread but cheap.",
        "",
        "## Two warnings",
        "",
        "**Never block inside async.** `thread::sleep` or a heavy computation stalls the whole executor thread and every task on it. Use `tokio::time::sleep`, or `spawn_blocking` for CPU work.",
        "",
        "**Async is infectious.** An `async fn` can only be awaited from async context, so the colouring spreads up the call graph. If your program is not IO-bound, plain threads are simpler and often faster.",
        "",
        "> The example below uses tokio, which the playground has available. Locally you would add `tokio = { version = \"1\", features = [\"full\"] }` to Cargo.toml.",
      ),
      code: `use std::time::{Duration, Instant};
use tokio::time::sleep;

/// An async fn returns a Future; nothing runs until it is awaited.
async fn fetch(name: &str, ms: u64) -> String {
    sleep(Duration::from_millis(ms)).await;
    format!("{name} finished after {ms}ms")
}

async fn might_fail(n: u32) -> Result<u32, String> {
    sleep(Duration::from_millis(10)).await;
    if n % 2 == 0 {
        Ok(n * 10)
    } else {
        Err(format!("{n} is odd"))
    }
}

#[tokio::main]
async fn main() {
    // Calling an async fn does nothing on its own.
    let future = fetch("lazy", 10);
    println!("the future exists but has not run");
    println!("{}", future.await);

    // Sequential: 60ms + 60ms.
    let start = Instant::now();
    let a = fetch("first", 60).await;
    let b = fetch("second", 60).await;
    println!("{a}");
    println!("{b}");
    println!("sequential took about {}ms", start.elapsed().as_millis());

    // Concurrent with join!: both run at once, so about 60ms total.
    let start = Instant::now();
    let (a, b) = tokio::join!(fetch("third", 60), fetch("fourth", 60));
    println!("{a}");
    println!("{b}");
    println!("joined took about {}ms", start.elapsed().as_millis());

    // Many futures at once.
    let start = Instant::now();
    let results = futures::future::join_all((1..=5).map(|i| fetch("task", i * 20))).await;
    for r in &results {
        println!("  {r}");
    }
    println!("five tasks took about {}ms", start.elapsed().as_millis());

    // spawn: hand the task to the runtime and carry on.
    let handle = tokio::spawn(async { fetch("spawned", 30).await });
    println!("spawned a task; doing other work meanwhile");
    println!("{}", handle.join_or_report().await);

    // select!: take whichever wins.
    tokio::select! {
        r = fetch("fast", 20) => println!("winner: {r}"),
        r = fetch("slow", 200) => println!("winner: {r}"),
    }

    // ? works in async fns exactly as it does elsewhere.
    for n in [2, 3] {
        match might_fail(n).await {
            Ok(v) => println!("{n} -> {v}"),
            Err(e) => println!("{n} -> error: {e}"),
        }
    }

    // A timeout, which is just select! against a timer.
    match tokio::time::timeout(Duration::from_millis(30), fetch("slowpoke", 200)).await {
        Ok(v) => println!("completed: {v}"),
        Err(_) => println!("timed out, as expected"),
    }

    // CPU-bound work belongs on a blocking thread, not the executor.
    let heavy = tokio::task::spawn_blocking(|| (1..=5_000_000u64).sum::<u64>())
        .await
        .unwrap();
    println!("blocking task computed {heavy}");
}

/// A tiny helper so the spawn example reads cleanly.
trait JoinOrReport {
    async fn join_or_report(self) -> String;
}

impl JoinOrReport for tokio::task::JoinHandle<String> {
    async fn join_or_report(self) -> String {
        match self.await {
            Ok(s) => s,
            Err(e) => format!("task failed: {e}"),
        }
    }
}`,
      exercise: {
        prompt:
          "Write two async functions that each sleep 50ms and return a number, then run them **concurrently** with `tokio::join!` and print their sum as `sum: 3`.",
        expect: { contains: ["sum: 3"], sourceContains: ["join!"] },
        hint: "`let (a, b) = tokio::join!(one(), two()); println!(\"sum: {}\", a + b);` — if you `await` them one at a time it still works, but takes twice as long.",
      },
    },

    {
      slug: "modules-and-crates",
      title: "Modules, paths and visibility",
      summary:
        "Organising code: `mod`, `pub`, `use`, and how a crate is laid out on disk.",
      tags: ["mod", "pub", "use", "crate"],
      body: md(
        "Rust's unit of compilation is a **crate**; the unit of organisation inside it is a **module**.",
        "",
        "```rust",
        "mod shapes {",
        "    pub struct Circle { pub r: f64 }",
        "    impl Circle { pub fn area(&self) -> f64 { 3.14 * self.r * self.r } }",
        "",
        "    pub mod units { pub const CM: &str = \"cm\"; }",
        "}",
        "use shapes::Circle;",
        "```",
        "",
        "## Everything is private by default",
        "",
        "Items are visible to their own module and its descendants. `pub` opens an item up — and note that `pub struct` does **not** make its fields public; each field needs its own `pub`. That default is deliberate: an API surface should be something you opt into, item by item.",
        "",
        "Finer-grained options: `pub(crate)` (visible crate-wide), `pub(super)` (to the parent), `pub(in path)`.",
        "",
        "## Paths",
        "",
        "- `crate::` — absolute, from the crate root.",
        "- `self::` / `super::` — relative to here / to the parent.",
        "- `use` just creates a shortcut; it does not change visibility unless you write `pub use` (a *re-export*, used to present a tidy public API that hides the internal layout).",
        "",
        "## On disk",
        "",
        "```text",
        "src/main.rs       binary crate root",
        "src/lib.rs        library crate root",
        "src/shapes.rs     or shapes/mod.rs  ->  mod shapes;",
        "src/shapes/circle.rs                ->  mod circle;  inside shapes",
        "src/bin/other.rs  a second binary",
        "tests/            integration tests",
        "```",
        "",
        "`mod shapes;` means \"load that file here\". There is no header-file or include-path machinery: the module tree is declared in code, and the compiler finds the files.",
        "",
        "> The playground is a single file, so the example below nests modules inline — exactly what the compiler sees after it reads the files.",
      ),
      code: `/// A module tree, inline. On disk each mod would be its own file.
mod geometry {
    /// Private to this module unless marked pub.
    const PRECISION: usize = 2;

    pub mod shapes {
        /// pub on the struct does not make the fields pub.
        #[derive(Debug)]
        pub struct Circle {
            pub radius: f64,
            label: String, // private: only geometry::shapes can touch it
        }

        impl Circle {
            pub fn new(radius: f64, label: &str) -> Self {
                Self { radius, label: label.to_string() }
            }
            pub fn area(&self) -> f64 {
                std::f64::consts::PI * self.radius * self.radius
            }
            /// super:: reaches the parent module.
            pub fn describe(&self) -> String {
                format!("{} r={:.*}", self.label, super::PRECISION, self.radius)
            }
        }

        #[derive(Debug)]
        pub struct Rect {
            pub w: f64,
            pub h: f64,
        }

        impl Rect {
            pub fn area(&self) -> f64 {
                self.w * self.h
            }
        }
    }

    pub mod units {
        pub const CM: &str = "cm";
        /// Visible crate-wide but not to the outside world of a real library.
        pub(crate) fn to_inches(cm: f64) -> f64 {
            cm / 2.54
        }
    }

    /// Visible only to geometry and its children.
    pub(self) fn internal_note() -> &'static str {
        "an implementation detail"
    }

    /// A re-export, so callers can say geometry::Circle.
    pub use shapes::Circle;

    pub fn summarise() -> String {
        format!("{} ({})", internal_note(), units::CM)
    }
}

/// A sibling module using an absolute path into the first one.
mod reporting {
    use crate::geometry::shapes::{Circle, Rect};
    use crate::geometry::units;

    pub fn report() {
        let c = Circle::new(1.5, "small circle");
        let r = Rect { w: 2.0, h: 3.0 };
        println!("  {} area {:.3}", c.describe(), c.area());
        println!("  rect {:?} area {:.1}", r, r.area());
        println!("  2.54{} is {:.1} inch", units::CM, units::to_inches(2.54));
    }
}

// Bringing names into scope at the top level.
use geometry::shapes::Rect;
use geometry::Circle; // via the re-export

fn main() {
    // Through the re-export.
    let c = Circle::new(2.0, "unit");
    println!("area {:.4}", c.area());
    println!("radius is public: {}", c.radius);
    // println!("{}", c.label);  // <-- uncomment: field is private

    // A fully qualified path, no use needed.
    let r = geometry::shapes::Rect { w: 4.0, h: 0.5 };
    println!("rect area {}", r.area());

    // The short name, thanks to the use above.
    let r2 = Rect { w: 1.0, h: 1.0 };
    println!("unit square area {}", r2.area());

    println!("module summary: {}", geometry::summarise());

    println!("another module's report:");
    reporting::report();

    // Nested and renamed imports.
    use std::collections::{HashMap as Dict, HashSet};
    let mut d: Dict<&str, i32> = Dict::new();
    d.insert("one", 1);
    let s: HashSet<i32> = d.values().copied().collect();
    println!("dict {:?} set {:?}", d, s);
}`,
      exercise: {
        prompt:
          "Create a module `math` with a `pub fn triple(n: i32) -> i32`, then call it from `main` as `math::triple(14)` and print `tripled: 42`.",
        expect: { contains: ["tripled: 42"], sourceContains: ["mod math"] },
        hint: "`mod math { pub fn triple(n: i32) -> i32 { n * 3 } }` — without `pub` the call from `main` will not compile.",
      },
    },

    {
      slug: "testing",
      title: "Testing",
      summary:
        "Unit tests next to the code, assertions, expected panics, and fallible tests.",
      tags: ["#[test]", "assert_eq!", "should_panic", "cargo test"],
      tests: true,
      body: md(
        "Tests live **in the same file as the code they test**, which is unusual and deliberate: a unit test can reach private functions, because it is inside the module.",
        "",
        "```rust",
        "#[cfg(test)]",
        "mod tests {",
        "    use super::*;",
        "",
        "    #[test]",
        "    fn two_plus_two() {",
        "        assert_eq!(add(2, 2), 4);",
        "    }",
        "}",
        "```",
        "",
        "`#[cfg(test)]` means the module is compiled only under `cargo test`, so it adds nothing to your release binary. `use super::*;` pulls in the parent module, private items included.",
        "",
        "## Assertions",
        "",
        "- `assert!(cond)` — and a custom message as extra arguments.",
        "- `assert_eq!(a, b)` / `assert_ne!` — prints both values on failure, which is why you should prefer them to `assert!(a == b)`.",
        "- `#[should_panic(expected = \"substring\")]` — the test passes only if it panics with a matching message.",
        "- A test returning `Result<(), E>` lets you use `?`; an `Err` fails the test.",
        "- `#[ignore]` skips by default; `cargo test -- --ignored` runs those.",
        "",
        "## The layout",
        "",
        "- **Unit tests** — inline, `#[cfg(test)] mod tests`, can see private items.",
        "- **Integration tests** — in `tests/`, compiled as separate crates, see only your public API.",
        "- **Doc tests** — code blocks in `///` comments are compiled *and run* by `cargo test`, so your documentation examples cannot silently rot. This is one of Rust's best features and is widely underused.",
        "",
        "Tests run in parallel by default (`--test-threads=1` to serialise), and `println!` output is hidden unless a test fails or you pass `--nocapture`.",
        "",
        "> This lesson runs in **test mode** — the Run button compiles as a library and executes the test harness. Try breaking an assertion and look at the failure output.",
      ),
      code: `/// Returns the sum of two numbers.
///
/// # Examples
///
/// This block is a doc test: cargo test compiles and runs it.
///
/// \`\`\`
/// assert_eq!(playground::add(2, 2), 4);
/// \`\`\`
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

pub fn parse_age(s: &str) -> Result<u8, std::num::ParseIntError> {
    s.trim().parse()
}

/// Panics on an empty slice — which the tests below pin down.
pub fn mean(xs: &[f64]) -> f64 {
    assert!(!xs.is_empty(), "mean of an empty slice is undefined");
    xs.iter().sum::<f64>() / xs.len() as f64
}

/// A private helper, reachable from the test module but not from outside.
#[allow(dead_code)] // only the tests below call it
fn is_even(n: i32) -> bool {
    n % 2 == 0
}

pub struct Counter {
    count: u32,
}

impl Counter {
    pub fn new() -> Self {
        Self { count: 0 }
    }
    pub fn bump(&mut self) -> u32 {
        self.count += 1;
        self.count
    }
    pub fn count(&self) -> u32 {
        self.count
    }
}

impl Default for Counter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_two_numbers() {
        assert_eq!(add(2, 2), 4);
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn assertion_with_a_message() {
        let result = add(10, 5);
        assert!(
            result > 10,
            "expected more than 10 but add(10, 5) gave {result}"
        );
        assert_ne!(result, 0);
    }

    #[test]
    fn reaches_private_items() {
        // Possible because this module is inside the one being tested.
        assert!(is_even(4));
        assert!(!is_even(7));
    }

    #[test]
    fn divides() {
        assert_eq!(divide(10.0, 4.0), Ok(2.5));
        assert!(divide(1.0, 0.0).is_err());
    }

    /// A test that returns Result can use ? on fallible calls.
    #[test]
    fn parses_an_age() -> Result<(), std::num::ParseIntError> {
        let age = parse_age(" 42 ")?;
        assert_eq!(age, 42);
        Ok(())
    }

    #[test]
    fn rejects_a_bad_age() {
        assert!(parse_age("old").is_err());
    }

    #[test]
    #[should_panic(expected = "undefined")]
    fn mean_of_nothing_panics() {
        mean(&[]);
    }

    #[test]
    fn mean_of_something_works() {
        let m = mean(&[1.0, 2.0, 6.0]);
        assert!((m - 3.0).abs() < f64::EPSILON, "got {m}");
    }

    #[test]
    fn counter_counts() {
        let mut c = Counter::new();
        assert_eq!(c.count(), 0);
        assert_eq!(c.bump(), 1);
        c.bump();
        assert_eq!(c.count(), 3 - 1);
    }

    #[test]
    #[ignore = "demonstrates #[ignore]; run with cargo test -- --ignored"]
    fn slow_test() {
        assert_eq!(add(1, 1), 2);
    }

    /// Table-driven tests keep related cases together and name the failure.
    #[test]
    fn table_of_cases() {
        let cases = [(0, true), (1, false), (2, true), (-3, false)];
        for (input, expected) in cases {
            assert_eq!(is_even(input), expected, "is_even({input})");
        }
    }
}`,
      exercise: {
        prompt:
          "Add a test called `adds_negatives` that asserts `add(-5, -5) == -10`, then run the suite. The output should show at least 9 passing tests and `0 failed`.",
        expect: { contains: ["0 failed"] },
        hint: "Inside `mod tests`, add:\n\n```rust\n#[test]\nfn adds_negatives() {\n    assert_eq!(add(-5, -5), -10);\n}\n```",
      },
    },

    {
      slug: "macros",
      title: "Macros",
      summary:
        "`macro_rules!` — writing code that writes code, and when not to.",
      tags: ["macro_rules!", "expansion", "hygiene"],
      body: md(
        "You have used macros since lesson one. `println!`, `vec!`, `format!`, `assert_eq!`, `derive` — all macros, and all doing things a function cannot: taking a variable number of arguments, checking a format string at compile time, or generating a trait impl.",
        "",
        "## macro_rules!",
        "",
        "A declarative macro matches on the *syntax* it is given and expands to new code:",
        "",
        "```rust",
        "macro_rules! my_vec {",
        "    ( $( $x:expr ),* $(,)? ) => {",
        "        { let mut v = Vec::new(); $( v.push($x); )* v }",
        "    };",
        "}",
        "```",
        "",
        "Read `$( $x:expr ),*` as \"zero or more expressions, comma-separated\", and `$( ... )*` in the body as \"repeat this once per match\".",
        "",
        "## Fragment specifiers",
        "",
        "| Specifier | Matches |",
        "|---|---|",
        "| `expr` | an expression |",
        "| `ident` | an identifier |",
        "| `ty` | a type |",
        "| `literal` | a literal |",
        "| `pat` | a pattern |",
        "| `stmt` `block` `item` | a statement / block / item |",
        "| `tt` | one token tree — the most flexible |",
        "",
        "## Hygiene",
        "",
        "Identifiers a macro introduces cannot collide with the caller's. A `let v` inside the macro will not clobber your `v`. That makes Rust macros dramatically safer than C's text substitution.",
        "",
        "## The other kind",
        "",
        "**Procedural macros** are Rust programs that take a token stream and return one, living in their own crate. Three flavours: `#[derive(...)]`, attribute macros (`#[tokio::main]`), and function-like. `serde`, `thiserror` and `tokio` are all built on them.",
        "",
        "> Macros are a last resort. They are harder to read, harder to debug, and worse for tooling than a generic function. Reach for one only when you need variadics, trait generation, or compile-time syntax checking — and use `cargo expand` to see what you wrote.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

/// Zero or more expressions, with an optional trailing comma.
macro_rules! my_vec {
    () => { Vec::new() };
    ( $( $x:expr ),* $(,)? ) => {
        {
            let mut v = Vec::new();
            $( v.push($x); )*
            v
        }
    };
}

/// Several rules, matched in order — like a match on syntax.
macro_rules! greet {
    () => { println!("hello, nobody") };
    ($name:expr) => { println!("hello, {}", $name) };
    ($name:expr, $times:expr) => {
        for _ in 0..$times {
            println!("hello, {}", $name);
        }
    };
}

/// Matching a type, to generate an impl.
macro_rules! impl_describe {
    ( $( $t:ty => $label:expr ),* $(,)? ) => {
        $(
            impl Describe for $t {
                fn describe(&self) -> String {
                    format!("{} with value {}", $label, self)
                }
            }
        )*
    };
}

trait Describe {
    fn describe(&self) -> String;
}

impl_describe! {
    i32 => "an integer",
    f64 => "a float",
    bool => "a boolean",
}

/// Capturing identifiers to build a struct plus a constructor.
macro_rules! config_struct {
    ($name:ident { $( $field:ident : $ty:ty = $default:expr ),* $(,)? }) => {
        #[derive(Debug)]
        struct $name {
            $( $field: $ty ),*
        }

        impl $name {
            fn new() -> Self {
                Self { $( $field: $default ),* }
            }
        }
    };
}

config_struct!(Settings {
    verbose: bool = false,
    retries: u32 = 3,
    name: String = "default".to_string(),
});

/// A macro that builds a HashMap literal.
macro_rules! map {
    ( $( $k:expr => $v:expr ),* $(,)? ) => {{
        let mut m = std::collections::HashMap::new();
        $( m.insert($k, $v); )*
        m
    }};
}

/// Compile-time assertions, and stringify! for diagnostics.
macro_rules! show {
    ($e:expr) => {
        println!("{:>24} = {:?}", stringify!($e), $e)
    };
}

/// Recursive macros: count the arguments.
macro_rules! count {
    () => { 0usize };
    ($head:tt $( $tail:tt )*) => { 1usize + count!( $( $tail )* ) };
}

fn main() {
    // Variadic, which a function cannot be.
    let empty: Vec<i32> = my_vec![];
    let nums = my_vec![1, 2, 3];
    let words = my_vec!["a", "b",]; // trailing comma accepted
    println!("{empty:?} {nums:?} {words:?}");

    // Several rules, chosen by shape.
    greet!();
    greet!("ada");
    greet!("bo", 2);

    // Generated trait impls.
    println!("{}", 42.describe());
    println!("{}", 1.5.describe());
    println!("{}", true.describe());

    // A generated struct and constructor.
    println!("{:?}", Settings::new());

    // A map literal.
    let ages = map!{ "ana" => 31, "bo" => 24 };
    let mut pairs: Vec<_> = ages.iter().collect();
    pairs.sort();
    println!("{pairs:?}");

    // stringify! sees the source text, not the value.
    show!(2 + 2 * 10);
    show!(nums.len());
    show!("literal");

    // Recursion over token trees.
    println!("count: {}", count!(a b c d e));

    // Hygiene: the macro's own v cannot clobber ours.
    let v = "untouched";
    let generated = my_vec![10, 20];
    println!("v is still {v:?}, generated {generated:?}");

    // Built-in macros worth knowing.
    println!("file {} line {}", file!(), line!());
    println!("compiled with debug_assertions: {}", cfg!(debug_assertions));
    println!("{}", concat!("con", "cat", "enated"));
    // unreachable!(), todo!(), unimplemented!() and matches!() are macros too.
    println!("matches!: {}", matches!(Some(3), Some(n) if n > 2));
}`,
      exercise: {
        prompt:
          "Write a `macro_rules!` macro named `square` that takes one expression and expands to it multiplied by itself, then print `squared: 36` using `square!(6)`.",
        expect: { contains: ["squared: 36"], sourceContains: ["macro_rules!"] },
        hint: "`macro_rules! square { ($x:expr) => { $x * $x }; }` — for safety against precedence surprises, write the body as `{ let v = $x; v * v }`.",
      },
    },

    {
      slug: "unsafe-rust",
      title: "unsafe Rust",
      summary:
        "The escape hatch: what it permits, what it does not, and how to contain it.",
      tags: ["unsafe", "raw pointers", "FFI", "UB"],
      body: md(
        "The compiler is conservative: it rejects some programs that are in fact correct, because it cannot prove they are. `unsafe` is how you say \"I have checked this myself\".",
        "",
        "## The five superpowers",
        "",
        "Inside an `unsafe` block you may, and only may:",
        "",
        "1. dereference a raw pointer (`*const T`, `*mut T`),",
        "2. call an `unsafe` function, including a foreign one,",
        "3. access or modify a mutable `static`,",
        "4. implement an `unsafe` trait (`Send`, `Sync`),",
        "5. access a `union` field.",
        "",
        "## What it does not do",
        "",
        "`unsafe` **does not** turn off the borrow checker, ownership, or type checking. Those all still apply. It only unlocks the five operations above. The name means \"the compiler cannot verify this\" — not \"anything goes\".",
        "",
        "And the burden is real: breaking the rules is **undefined behaviour**, which is not a crash you can debug but a licence for the optimiser to assume the impossible. Data races, dangling pointers, aliasing a `&mut`, misaligned reads, invalid values in a type — all UB.",
        "",
        "## When it is legitimate",
        "",
        "- **FFI** — calling C, or exposing Rust to C. By far the most common reason.",
        "- **Hardware and OS interfaces** — memory-mapped registers, syscalls.",
        "- **Data structures the borrow checker cannot express** — intrusive lists, custom allocators. `Vec` and `Arc` are themselves `unsafe` inside.",
        "- **Measured optimisations**, such as skipping a bounds check in a proven-hot loop. Measure first; the checks are usually free after optimisation.",
        "",
        "## Containing it",
        "",
        "The discipline is to wrap `unsafe` in a **safe abstraction** that upholds the invariant, document exactly what the caller must guarantee with a `# Safety` section, and keep the unsafe block as small as possible. Then run [Miri](https://github.com/rust-lang/miri) (`cargo +nightly miri test`), which detects much UB at runtime.",
        "",
        "> Most Rust programmers write no `unsafe` at all, for years. That is the intended outcome, not a gap in your knowledge.",
      ),
      code: `/// A mutable static is shared global state, so every access is unsafe.
static mut COUNTER: u32 = 0;

/// Documented unsafe function: the contract is on the caller.
///
/// # Safety
/// \`ptr\` must be non-null, aligned, and point to an initialised i32.
unsafe fn read_twice(ptr: *const i32) -> i32 {
    *ptr + *ptr
}

/// A SAFE abstraction over an unsafe operation. Callers need no unsafe at all,
/// because this function upholds the invariant itself.
fn split_at_mut_manual(slice: &mut [i32], mid: usize) -> (&mut [i32], &mut [i32]) {
    let len = slice.len();
    let ptr = slice.as_mut_ptr();
    assert!(mid <= len, "mid is out of range"); // the invariant, checked

    unsafe {
        // Safe because the assert above proves the two halves do not overlap
        // and both stay inside the original allocation.
        (
            std::slice::from_raw_parts_mut(ptr, mid),
            std::slice::from_raw_parts_mut(ptr.add(mid), len - mid),
        )
    }
}

// Calling into C. These come from libc, which is always linked.
extern "C" {
    fn abs(input: i32) -> i32;
    fn strlen(s: *const std::ffi::c_char) -> usize;
}

/// Exposing a Rust function to C. No unsafe needed to define it.
#[no_mangle]
pub extern "C" fn rust_double(x: i32) -> i32 {
    x * 2
}

union IntOrBytes {
    int: u32,
    bytes: [u8; 4],
}

fn main() {
    // 1. Raw pointers. Creating them is safe; dereferencing is not.
    let x = 42;
    let ptr: *const i32 = &x;
    let mut y = 10;
    let mut_ptr: *mut i32 = &mut y;
    println!("raw pointers created safely: {ptr:?}");

    unsafe {
        println!("deref const ptr: {}", *ptr);
        *mut_ptr += 5;
        println!("deref mut ptr:   {}", *mut_ptr);
    }
    println!("y is now {y}");

    // A raw pointer can be null or dangling, so always check.
    let null: *const i32 = std::ptr::null();
    println!("is null? {}", null.is_null());
    unsafe {
        println!("as_ref on null: {:?}", null.as_ref());
    }

    // 2. Calling an unsafe function.
    unsafe {
        println!("read_twice: {}", read_twice(ptr));
    }

    // The safe wrapper needs no unsafe at the call site.
    let mut data = [1, 2, 3, 4, 5, 6];
    let (left, right) = split_at_mut_manual(&mut data, 3);
    left[0] = 100;
    right[0] = 400;
    println!("after a safe wrapper over unsafe: {data:?}");

    // 3. A mutable static: unsafe because nothing stops a data race.
    unsafe {
        let counter = &raw mut COUNTER;
        *counter += 1;
        *counter += 1;
        println!("static COUNTER = {}", *counter);
    }

    // 4. FFI into C.
    unsafe {
        println!("C abs(-7) = {}", abs(-7));
        let c_string = std::ffi::CString::new("hello from rust").unwrap();
        println!("C strlen  = {}", strlen(c_string.as_ptr()));
    }
    println!("rust_double is callable from C, and from here: {}", rust_double(21));

    // 5. Unions: only one field is valid at a time, and the compiler
    //    cannot know which, so reading is unsafe.
    let u = IntOrBytes { int: 0x41424344 };
    unsafe {
        println!("union as int   {:#x}", u.int);
        println!("union as bytes {:?}", u.bytes);
    }

    // Transmute is the sharpest tool here; prefer a safe conversion.
    let bits = 1.5f32.to_bits();
    println!("f32 1.5 as bits: {bits:#x} (to_bits, no unsafe needed)");

    // What unsafe does NOT relax: ownership and borrowing still apply.
    let owned = String::from("still checked");
    let moved = owned;
    // unsafe { println!("{owned}"); } // <-- uncomment: still a move error
    println!("{moved}");
}`,
      exercise: {
        prompt:
          "Create an `i32` with value 7, take a `*const i32` raw pointer to it, and print its value through the pointer inside an `unsafe` block so the output contains `through pointer: 7`.",
        expect: { contains: ["through pointer: 7"], sourceContains: ["unsafe"] },
        hint: "`let n = 7; let p: *const i32 = &n; unsafe { println!(\"through pointer: {}\", *p); }`",
      },
    },
  ],
};
