import { md } from "./_util.js";

/**
 * The fast track: one hour, aimed at someone who already ships software in
 * another language. It assumes syntax can be read from context and spends its
 * budget on the model, the idioms and the judgement calls instead.
 */

const coreModel = {
  id: "ft-core",
  n: 1,
  path: "fast",
  title: "The core model",
  summary:
    "The three ideas the rest of Rust is built on, compressed: the mental model, ownership, and types as the design tool.",
  lessons: [
    {
      slug: "ft-rust-in-five-minutes",
      title: "Rust in five minutes",
      minutes: 5,
      summary:
        "The whole language in one annotated program — read this and the rest of the hour is detail.",
      tags: ["mental model", "orientation"],
      body: md(
        "If you already write C++, Go, TypeScript, Java, Python or Swift, most of Rust's syntax will read itself. Five things will not, and they are what the rest of this hour is about.",
        "",
        "**1. Ownership replaces both GC and manual free.** Every value has exactly one owner; when the owner goes out of scope the value is dropped. The compiler inserts the deallocation, so there is no collector, no pauses, and no `free()` to get wrong. Assigning or passing a heap-owning value *moves* it, and the source binding becomes unusable.",
        "",
        "**2. Borrowing is checked statically.** `&T` is a shared read-only reference, `&mut T` an exclusive one. The rule — *many readers or one writer, never both* — is the definition of a data race, enforced at compile time. This is the same mechanism that later gives you thread safety for free.",
        "",
        "**3. Enums are sum types, and `match` is exhaustive.** There is no `null` and there are no exceptions. Absence is `Option<T>`, failure is `Result<T, E>`, and the compiler refuses to let you use either without handling both cases. Add a variant later and every incomplete `match` becomes a build error.",
        "",
        "**4. Traits, not inheritance.** Behaviour is shared by implementing traits; there is no class hierarchy and no subtyping. Generics are monomorphised, so trait-bounded generic code costs nothing at runtime; `dyn Trait` opts into a vtable when you actually need heterogeneity.",
        "",
        "**5. Abstractions are zero-cost by default.** Iterator chains, `Option`, newtypes and generics compile down to what you would have written by hand. What *is* expensive is explicit: `.clone()`, `Box::new`, `Arc`, `.collect()`.",
        "",
        "> Everything else — modules, closures, lifetimes, `async` — is ordinary language design. These five are the ones that will trip you up if you reach for habits from elsewhere.",
      ),
      code: `use std::collections::HashMap;
use std::fmt;

// 3. Sum types: a value is exactly one of these, and each carries its own data.
#[derive(Debug, Clone, PartialEq)]
enum Payment {
    Cash,
    Card { last4: String },
    Transfer(String),
}

#[derive(Debug)]
struct Order {
    id: u32,
    items: Vec<(String, u32)>, // (name, cents)
    payment: Payment,
}

// 4. Traits, not inheritance. Implementing Display gives us {} and to_string().
impl fmt::Display for Order {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "order #{} ({} items, {})", self.id, self.items.len(), self.payment)
    }
}

impl fmt::Display for Payment {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Payment::Cash => write!(f, "cash"),
            Payment::Card { last4 } => write!(f, "card ****{last4}"),
            Payment::Transfer(bank) => write!(f, "transfer via {bank}"),
        }
    }
}

impl Order {
    // &self borrows: the caller keeps ownership, nothing is copied.
    fn total(&self) -> u32 {
        self.items.iter().map(|(_, cents)| cents).sum()
    }

    // 3. Failure is a value, not an exception. The caller cannot ignore it.
    fn validate(&self) -> Result<(), String> {
        if self.items.is_empty() {
            return Err(format!("order {} has no items", self.id));
        }
        if let Payment::Card { last4 } = &self.payment {
            if last4.len() != 4 {
                return Err(format!("order {}: bad card suffix {last4:?}", self.id));
            }
        }
        Ok(())
    }
}

// 4. A trait bound: works for any T that can be displayed. Monomorphised, so
//    this costs exactly as much as writing it out per type.
fn announce<T: fmt::Display>(label: &str, value: T) {
    println!("  {label}: {value}");
}

fn main() {
    let orders = vec![
        Order {
            id: 1,
            items: vec![("coffee".into(), 350), ("pastry".into(), 275)],
            payment: Payment::Card { last4: "4242".into() },
        },
        Order { id: 2, items: vec![], payment: Payment::Cash },
        Order {
            id: 3,
            items: vec![("tea".into(), 300)],
            payment: Payment::Transfer("acme bank".into()),
        },
    ];

    // 5. Lazy iterator chain: no intermediate Vec is built.
    let revenue: u32 = orders.iter().filter(|o| o.validate().is_ok()).map(Order::total).sum();
    announce("revenue (cents)", revenue);

    // 3. Exhaustive matching: adding a Payment variant breaks this at compile
    //    time, which is the point.
    let mut by_method: HashMap<&str, u32> = HashMap::new();
    for order in &orders {
        let key = match &order.payment {
            Payment::Cash => "cash",
            Payment::Card { .. } => "card",
            Payment::Transfer(_) => "transfer",
        };
        *by_method.entry(key).or_insert(0) += order.total();
    }
    let mut rows: Vec<_> = by_method.into_iter().collect();
    rows.sort();
    announce("by method", format!("{rows:?}"));

    // 3. Errors are ordinary values you can collect, count and report.
    for order in &orders {
        match order.validate() {
            Ok(()) => println!("  ok: {order}"),
            Err(why) => println!("  rejected: {why}"),
        }
    }

    // 1 + 2. Ownership and borrowing, concretely.
    let names: Vec<String> = orders.iter().map(|o| o.to_string()).collect();
    print_all(&names); // borrow: we lend the vector out...
    println!("  still owned here: {} entries", names.len()); // ...and still have it

    let consumed = consume(names); // move: ownership transfers
    println!("  consume returned {consumed} chars");
    // println!("{names:?}"); // <-- uncomment: "borrow of moved value"

    // 2. One writer at a time, checked at compile time.
    let mut tally = vec![1, 2, 3];
    bump_all(&mut tally);
    println!("  mutated in place: {tally:?}");
}

fn print_all(items: &[String]) {
    for item in items {
        println!("  - {item}");
    }
}

fn consume(items: Vec<String>) -> usize {
    items.iter().map(|s| s.len()).sum()
}

fn bump_all(items: &mut Vec<i32>) {
    for n in items.iter_mut() {
        *n += 10;
    }
}`,
      exercise: {
        prompt:
          "Add a `Payment::Voucher(u32)` variant carrying a discount in cents. The compiler will now reject the program in two places — fix both, and make the run succeed. That compiler-driven refactor is the single most valuable habit Rust gives you.",
        expect: { contains: ["revenue"], sourceContains: ["Voucher"] },
        hint: "Add the variant, then handle it in `impl Display for Payment` and in the `match` inside `main`. The errors tell you exactly which arms are missing.",
      },
    },

    {
      slug: "ft-ownership-at-speed",
      title: "Ownership, borrowing and lifetimes at speed",
      minutes: 7,
      summary:
        "The rules, the four errors you will actually hit, and the decision table for &T vs &mut T vs T.",
      tags: ["ownership", "borrowck", "lifetimes"],
      body: md(
        "## The rules, complete",
        "",
        "1. Each value has one owner; it is dropped when the owner leaves scope.",
        "2. Any number of `&T`, **or** exactly one `&mut T`, never both at once.",
        "3. A reference may never outlive its referent.",
        "",
        "That is the entire borrow checker. Everything else is the compiler proving those three.",
        "",
        "## Choosing a parameter type",
        "",
        "This table resolves most design questions:",
        "",
        "| Take | When | Signals to the caller |",
        "|---|---|---|",
        "| `&T` | you only read | \"I will not keep or change this\" |",
        "| `&mut T` | you modify in place | \"I will change your value\" |",
        "| `T` | you store it, consume it, or transform it | \"I am taking this\" |",
        "",
        "Default to `&T`. Take `T` when you genuinely need ownership — storing it in a struct, returning a transformed version — rather than to dodge a borrow error.",
        "",
        "## The four errors, and their real fixes",
        "",
        "- **E0382 \"use of moved value\"** — you passed by value then used it again. Fix: borrow instead (`&x`), or restructure. `clone()` is the last resort, not the first.",
        "- **E0502/E0499 \"cannot borrow as mutable\"** — a shared borrow is still alive. Fix: shorten its life, copy the small value out first, or split the data (`split_at_mut`, separate fields — the borrow checker understands *disjoint fields*, so `self.a` and `self.b` can be borrowed independently).",
        "- **E0597 \"does not live long enough\"** — a reference outlives its target. Fix: return an owned value, or hoist the owner up a scope.",
        "- **E0106 \"missing lifetime specifier\"** — the compiler cannot tell which input a returned reference came from. Fix: annotate, or return owned.",
        "",
        "## Things that trip up newcomers",
        "",
        "- Borrows end at their **last use**, not at the closing brace. Material claiming otherwise predates non-lexical lifetimes.",
        "- Lifetimes **describe** relationships; they never extend anything's life.",
        "- `'static` on a bound means \"contains no short-lived borrows\", which is usually satisfied by owned data — it does not mean \"leaks forever\".",
        "- If you are writing `Rc<RefCell<T>>` everywhere, you have probably modelled a graph where a tree plus indices would do. Consider an arena: store nodes in a `Vec` and refer to them by index.",
        "",
        "> Fighting the borrow checker almost always means the *ownership design* is unclear, not that the checker is wrong. Ask \"who owns this, and for how long?\" before reaching for `clone`.",
      ),
      code: `#[derive(Debug)]
struct Document {
    title: String,
    body: String,
    views: u32,
}

impl Document {
    // &self: read-only, the cheapest thing to offer.
    fn word_count(&self) -> usize {
        self.body.split_whitespace().count()
    }

    // &mut self: mutate in place.
    fn record_view(&mut self) {
        self.views += 1;
    }

    // self: consumes, because the result replaces the input.
    fn into_summary(self) -> String {
        format!("{} ({} words, {} views)", self.title, self.word_count(), self.views)
    }

    // Returning a borrow tied to &self: no allocation, caller decides what next.
    fn first_line(&self) -> &str {
        self.body.lines().next().unwrap_or("")
    }

    // Disjoint fields can be borrowed independently — a very useful escape hatch.
    fn retitle_from_body(&mut self) {
        let candidate = self.body.lines().next().unwrap_or("untitled");
        // &self.body (shared) and &mut self.title (exclusive) coexist happily,
        // because the compiler tracks fields separately.
        self.title.clear();
        self.title.push_str(candidate);
    }
}

fn main() {
    let mut doc = Document {
        title: "Draft".to_string(),
        body: "ownership is the whole game\nthe rest is detail".to_string(),
        views: 0,
    };

    // Borrow for reading; doc is untouched.
    println!("words: {}", doc.word_count());
    println!("first line: {:?}", doc.first_line());

    // Borrow mutably; still ours afterwards.
    doc.record_view();
    doc.record_view();
    doc.retitle_from_body();
    println!("after edits: {} / {} views", doc.title, doc.views);

    // Borrows end at last use, so this is legal in modern Rust.
    let line = doc.first_line().to_string(); // copy out, borrow ends here
    doc.record_view(); // mutation allowed now
    println!("{line} / {} views", doc.views);

    // Holding the borrow across the mutation is not:
    // let held = doc.first_line();
    // doc.record_view();          // error[E0502]
    // println!("{held}");

    // Prefer &[T] over &Vec<T> in parameters: it accepts strictly more callers.
    let scores = vec![10, 20, 30];
    println!("mean: {:.1}", mean(&scores));
    println!("mean of an array: {:.1}", mean(&[1, 2, 3, 4]));
    println!("scores still here: {scores:?}");

    // Copying a small value out avoids holding a borrow at all.
    let mut queue = vec![3, 1, 2];
    let first = queue[0]; // i32 is Copy
    queue.sort();
    println!("was {first}, now {queue:?}");

    // Two disjoint &mut into one slice.
    let mut data = [1, 2, 3, 4];
    let (left, right) = data.split_at_mut(2);
    left[0] = 100;
    right[0] = 300;
    println!("split borrows: {data:?}");

    // Arena pattern: indices instead of Rc<RefCell<..>> for a graph.
    let mut tree = Arena::default();
    let root = tree.add("root", None);
    let a = tree.add("a", Some(root));
    tree.add("b", Some(root));
    tree.add("a1", Some(a));
    println!("arena: {} nodes, children of root: {:?}", tree.nodes.len(), tree.children(root));

    // self-consuming method: doc is gone after this.
    println!("summary: {}", doc.into_summary());
}

fn mean(xs: &[i32]) -> f64 {
    if xs.is_empty() {
        return 0.0;
    }
    xs.iter().sum::<i32>() as f64 / xs.len() as f64
}

/// Indices sidestep shared-ownership cycles entirely, and stay Send.
#[derive(Default)]
struct Arena {
    nodes: Vec<(String, Option<usize>)>,
}

impl Arena {
    fn add(&mut self, name: &str, parent: Option<usize>) -> usize {
        self.nodes.push((name.to_string(), parent));
        self.nodes.len() - 1
    }
    fn children(&self, id: usize) -> Vec<&str> {
        self.nodes
            .iter()
            .filter(|(_, parent)| *parent == Some(id))
            .map(|(name, _)| name.as_str())
            .collect()
    }
}`,
      exercise: {
        prompt:
          "Write `fn longest_word(text: &str) -> &str` that returns the longest whitespace-separated word, borrowing from the input rather than allocating. Call it on `\"ownership borrowing lifetimes\"` and print `longest: borrowing`.",
        expect: { contains: ["longest: borrowing"] },
        hint: "`text.split_whitespace().max_by_key(|w| w.len()).unwrap_or(\"\")`. No lifetime annotation is needed: there is one input reference, so elision applies.",
      },
    },

    {
      slug: "ft-types-as-design",
      title: "Types as the design tool",
      minutes: 6,
      summary:
        "Making illegal states unrepresentable — the habit that separates Rust that works from Rust that fights you.",
      tags: ["newtype", "sum types", "typestate"],
      body: md(
        "In most languages the type system is a tax you pay. In Rust it is where the design lives, because the compiler will enforce whatever you encode. Three techniques carry most of the value.",
        "",
        "## 1. Newtypes",
        "",
        "`struct UserId(u64)` is free at runtime and makes `UserId` and `OrderId` non-interchangeable. Every function signature taking a bare `u64`, `String` or `bool` is an opportunity to pass the wrong one. The newtype is also where validation belongs: make the constructor fallible and the invariant holds everywhere afterwards.",
        "",
        "Avoid boolean parameters for the same reason — `send(msg, true, false)` is unreadable; a two-variant enum is self-documenting and extensible.",
        "",
        "## 2. Make illegal states unrepresentable",
        "",
        "Instead of a struct with optional fields and a comment explaining which combinations are legal, use an enum where each variant carries exactly the data that state needs:",
        "",
        "```rust",
        "// Weak: four fields, nine illegal combinations, all your problem",
        "struct Conn { connected: bool, session: Option<String>, error: Option<String> }",
        "",
        "// Strong: three states, no illegal combination exists",
        "enum Conn { Idle, Live { session: String }, Failed(String) }",
        "```",
        "",
        "You can take this further with **typestate**: encode the state in the type, so `Draft::publish()` consumes the draft and returns a `Published`. Calling a method in the wrong state then fails to compile rather than at runtime.",
        "",
        "## 3. Parse, don't validate",
        "",
        "Validate once at the boundary and return a *different type* that proves the check happened. A function taking `Email` never has to re-check; a function taking `String` can never be sure. This is why `Result<T, E>` beats a `bool` return plus an out-parameter.",
        "",
        "> The payoff compounds. Every invariant you push into a type is one you never test for, never document, and never debug in production.",
      ),
      code: `use std::fmt;

// 1. Newtypes: zero-cost, and impossible to mix up.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct UserId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct OrderId(u64);

// 3. Parse, don't validate: the only way to get an Email is through try_new,
//    so every later use is already known to be well formed.
#[derive(Debug, Clone, PartialEq)]
struct Email(String);

impl Email {
    fn try_new(raw: &str) -> Result<Self, String> {
        let raw = raw.trim();
        match raw.split_once('@') {
            Some((user, domain)) if !user.is_empty() && domain.contains('.') => {
                Ok(Email(raw.to_ascii_lowercase()))
            }
            _ => Err(format!("{raw:?} is not an email address")),
        }
    }
    fn domain(&self) -> &str {
        self.0.split_once('@').map(|(_, d)| d).unwrap_or("")
    }
}

impl fmt::Display for Email {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str(&self.0)
    }
}

// 1. An enum instead of a bool parameter: readable at the call site.
#[derive(Debug, Clone, Copy)]
enum Visibility {
    Public,
    Private,
}

// 2. Illegal states cannot be built. There is no "connected with an error".
#[derive(Debug)]
enum Connection {
    Idle,
    Live { session: String, since_ms: u64 },
    Failed { reason: String, retries: u32 },
}

impl Connection {
    fn describe(&self) -> String {
        match self {
            Connection::Idle => "idle".to_string(),
            Connection::Live { session, since_ms } => format!("live as {session} for {since_ms}ms"),
            Connection::Failed { reason, retries } => format!("failed ({reason}), {retries} retries"),
        }
    }
}

// 2b. Typestate: publishing consumes the Draft, so a Draft cannot be published
//     twice and a Published cannot be edited. Both are compile-time facts.
struct Draft {
    title: String,
    body: String,
}

struct Published {
    title: String,
    body: String,
    visibility: Visibility,
}

impl Draft {
    fn new(title: &str) -> Self {
        Self { title: title.to_string(), body: String::new() }
    }
    fn write(mut self, text: &str) -> Self {
        self.body.push_str(text);
        self
    }
    fn publish(self, visibility: Visibility) -> Published {
        Published { title: self.title, body: self.body, visibility }
    }
}

impl Published {
    fn summary(&self) -> String {
        format!("{:?} post {:?} ({} bytes)", self.visibility, self.title, self.body.len())
    }
}

/// The signature alone rules out passing an order id where a user id belongs.
fn fetch_profile(user: UserId) -> String {
    format!("profile of user {}", user.0)
}

fn main() {
    let user = UserId(7);
    let order = OrderId(7);
    println!("{}", fetch_profile(user));
    // fetch_profile(order);  // <-- uncomment: expected UserId, found OrderId
    println!("same number, different types: {}", user.0 == order.0);

    // Validation happens once, at the edge.
    for raw in ["Ada@Example.COM ", "nope", "a@b"] {
        match Email::try_new(raw) {
            Ok(email) => println!("accepted {email} (domain {})", email.domain()),
            Err(why) => println!("rejected: {why}"),
        }
    }

    // A state machine with no representable bad state.
    let states = [
        Connection::Idle,
        Connection::Live { session: "s-91".into(), since_ms: 1200 },
        Connection::Failed { reason: "timeout".into(), retries: 3 },
    ];
    for s in &states {
        println!("  {}", s.describe());
    }

    // Typestate: the compiler enforces the lifecycle.
    let post = Draft::new("Types as design")
        .write("newtypes, sum types, typestate")
        .publish(Visibility::Public);
    println!("{}", post.summary());

    // The enum reads at the call site; a bare boolean argument would not.
    let draft = Draft::new("Notes to self").write("not ready").publish(Visibility::Private);
    println!("{}", draft.summary());
    // post.write("more");  // <-- uncomment: Published has no write method
}`,
      exercise: {
        prompt:
          "Add a newtype `Cents(u64)` with a method `fn as_pounds(&self) -> f64` dividing by 100, and print `price: 12.50` for `Cents(1250)`.",
        expect: { contains: ["price: 12.50"] },
        hint: "`struct Cents(u64);` then `self.0 as f64 / 100.0`, printed with `{:.2}`. The newtype costs nothing at runtime but stops you passing a count of items where a price belongs.",
      },
    },
  ],
};

const idiomatic = {
  id: "ft-idiomatic",
  n: 2,
  path: "fast",
  title: "Writing it idiomatically",
  summary:
    "Errors, traits and iterators the way Rust programmers actually write them.",
  lessons: [
    {
      slug: "ft-error-handling",
      title: "Error handling that scales",
      minutes: 6,
      summary:
        "`?`, thiserror vs anyhow, adding context, and the honest rules for when to panic.",
      tags: ["Result", "?", "thiserror", "anyhow"],
      body: md(
        "## The split",
        "",
        "- **`Result<T, E>`** for anything a caller might reasonably handle: missing file, bad input, network failure. These are *cases*, not bugs.",
        "- **`panic!`** for broken invariants — a bug in your code. Index out of bounds, `unwrap` on `None`, failed assertion.",
        "",
        "`Result` is `#[must_use]`, so you cannot silently ignore a failure.",
        "",
        "## `?` and the `From` conversion",
        "",
        "`let n = s.parse()?;` means: unwrap on success, otherwise `return Err(e.into())`. That `.into()` is the important half — `?` applies `From`, so one function can propagate several foreign error types into its own.",
        "",
        "## Which error type",
        "",
        "| Context | Use | Why |",
        "|---|---|---|",
        "| Library | a concrete enum, usually via **thiserror** | callers can `match` on the cases |",
        "| Application | **anyhow**, or `Box<dyn Error>` | the consumer is a human reading a log |",
        "| Prototype | `Box<dyn Error>` | zero ceremony, swap later |",
        "",
        "Never `Err(String)` in a public API: it forces callers into string comparison and throws away the structure.",
        "",
        "## Context is what makes errors useful",
        "",
        "\"No such file or directory\" is useless; \"failed to read config at /etc/app.toml: No such file\" is actionable. With `anyhow` that is `.context(\"...\")`; by hand, wrap the cause in your own variant and implement `source()`.",
        "",
        "## The honest rules for `unwrap`",
        "",
        "- Fine in tests, examples, and `main` for a genuinely impossible case.",
        "- `expect(\"...\")` over `unwrap()` always — the message is a comment the panic prints for you. Say *why you expected success*, not what failed.",
        "- In a library or long-running service, treat `unwrap` on external input as a bug.",
        "- `unwrap_or`, `unwrap_or_else`, `unwrap_or_default` and `ok_or` are usually what you actually wanted.",
        "",
        "> Clippy's `unwrap_used` and `expect_used` lints can be enabled per-crate if you want this enforced.",
      ),
      code: `use std::error::Error;
use std::fmt;

/// A library-style error: one variant per failure mode, each carrying what the
/// caller needs to react. This is what thiserror generates for you.
#[derive(Debug)]
enum ConfigError {
    Missing { key: &'static str },
    NotANumber { key: &'static str, source: std::num::ParseIntError },
    OutOfRange { key: &'static str, value: u32, max: u32 },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::Missing { key } => write!(f, "missing required key {key:?}"),
            ConfigError::NotANumber { key, .. } => write!(f, "key {key:?} is not a number"),
            ConfigError::OutOfRange { key, value, max } => {
                write!(f, "key {key:?} is {value}, which exceeds the maximum of {max}")
            }
        }
    }
}

impl Error for ConfigError {
    /// Exposing the cause is what lets callers print a full chain.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            ConfigError::NotANumber { source, .. } => Some(source),
            _ => None,
        }
    }
}

struct Config<'a>(&'a str);

impl<'a> Config<'a> {
    fn raw(&self, key: &'static str) -> Result<&'a str, ConfigError> {
        self.0
            .lines()
            .filter_map(|l| l.split_once('='))
            .find(|(k, _)| k.trim() == key)
            .map(|(_, v)| v.trim())
            .ok_or(ConfigError::Missing { key })
    }

    /// Note how little this body says about errors: ? carries them out, and the
    /// map_err attaches the context that makes the message useful.
    fn number(&self, key: &'static str, max: u32) -> Result<u32, ConfigError> {
        let raw = self.raw(key)?;
        let value: u32 = raw
            .parse()
            .map_err(|source| ConfigError::NotANumber { key, source })?;
        if value > max {
            return Err(ConfigError::OutOfRange { key, value, max });
        }
        Ok(value)
    }
}

/// Application style: one opaque error type, because the consumer is a log.
/// This is the shape anyhow gives you, without the dependency.
fn load(text: &str) -> Result<(u32, u32), Box<dyn Error>> {
    let cfg = Config(text);
    let port = cfg.number("port", 65535)?;
    let workers = cfg.number("workers", 64)?;
    Ok((port, workers))
}

/// Print an error plus its whole cause chain — what a good CLI does on exit.
fn report(err: &dyn Error) {
    println!("  error: {err}");
    let mut cause = err.source();
    while let Some(c) = cause {
        println!("    caused by: {c}");
        cause = c.source();
    }
}

fn main() {
    let good = "port = 8080\nworkers = 8";
    let missing = "port = 8080";
    let bad = "port = eighty\nworkers = 8";
    let huge = "port = 99999\nworkers = 8";

    for (label, text) in [("good", good), ("missing", missing), ("bad", bad), ("huge", huge)] {
        print!("{label:>8}: ");
        match load(text) {
            Ok((port, workers)) => println!("port {port}, {workers} workers"),
            Err(e) => {
                println!();
                report(e.as_ref());
            }
        }
    }

    // Callers can still match on the specific case — the reason to prefer an
    // enum over a string in a library.
    let cfg = Config(huge);
    if let Err(ConfigError::OutOfRange { max, .. }) = cfg.number("port", 65535) {
        println!("recovering: falling back to {max}");
    }

    // The combinators you should reach for before unwrap().
    let cfg = Config(missing);
    println!("or default:  {}", cfg.number("workers", 64).unwrap_or(4));
    println!("or computed: {}", cfg.number("workers", 64).unwrap_or_else(|_| 2 * 2));
    println!("as Option:   {:?}", cfg.number("workers", 64).ok());

    // expect() documents the assumption it is making.
    let port = Config(good).number("port", 65535).expect("the good config always parses");
    println!("port {port}");
}`,
      exercise: {
        prompt:
          "Write `fn parse_port(s: &str) -> Result<u16, Box<dyn std::error::Error>>` that parses `s` with `?` and rejects port 0 with a descriptive error. Print the result for `\"8080\"` so the output contains `Ok(8080)`.",
        expect: { contains: ["Ok(8080)"], sourceContains: ["?"] },
        hint: "`let p: u16 = s.trim().parse()?;` then `if p == 0 { return Err(\"port 0 is reserved\".into()); }`. A `&str` converts into `Box<dyn Error>` via `From`.",
      },
    },

    {
      slug: "ft-traits-and-dispatch",
      title: "Traits, generics and dispatch",
      minutes: 6,
      summary:
        "Static vs dynamic, the derives you should reach for, and the conversion traits that make APIs pleasant.",
      tags: ["traits", "generics", "dyn", "From"],
      body: md(
        "## Static or dynamic",
        "",
        "| | `impl Trait` / `<T: Trait>` | `dyn Trait` |",
        "|---|---|---|",
        "| Dispatch | compile time, inlinable | vtable, one indirect call |",
        "| Code size | a copy per type | one copy |",
        "| Compile time | slower | faster |",
        "| Mixed types in one collection | no | **yes** |",
        "",
        "Default to generics. Switch to `Box<dyn Trait>` when you need heterogeneity (a `Vec` of different implementors), when you return different types from different branches, or when monomorphisation is bloating compile times.",
        "",
        "Not every trait can be `dyn`: **object safety** forbids generic methods and methods returning `Self` by value. That is why `Clone` is not object safe.",
        "",
        "## Derives worth knowing by heart",
        "",
        "`Debug` on essentially everything. `Clone` when duplication makes sense, `Copy` only for small plain-data types. `PartialEq`/`Eq`, `PartialOrd`/`Ord` for comparison and sorting, `Hash` for map keys, `Default` for config-like structs.",
        "",
        "`Eq` and `Ord` are the *total* versions — floats cannot have them, which is why sorting `f64` needs `sort_by(|a, b| a.partial_cmp(b).unwrap())`.",
        "",
        "## The conversion traits",
        "",
        "Implement **`From`**, never `Into` — you get `Into` for free, plus the conversion that `?` performs on errors.",
        "",
        "Accepting `impl Into<String>` or `impl AsRef<Path>` in a constructor lets callers pass either form without `.to_string()` at every call site. Use it on public APIs; skip it internally where it just adds noise.",
        "",
        "## Blanket impls and extension traits",
        "",
        "`impl<T: Display> MyTrait for T` implements your trait for every displayable type at once — this is how `ToString` works. Defining a small local trait to add methods to a foreign type (an *extension trait*) is the idiomatic way around the orphan rule.",
        "",
        "> The orphan rule: you may implement a trait for a type only if you own one of them. When you own neither, wrap it in a newtype.",
      ),
      code: `use std::fmt::{self, Debug, Display};

trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> &'static str;
    /// A default method, available on trait objects too.
    fn report(&self) -> String {
        format!("{} with area {:.2}", self.name(), self.area())
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct Circle(f64);
#[derive(Debug, Clone, Copy, PartialEq)]
struct Square(f64);

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.0 * self.0
    }
    fn name(&self) -> &'static str {
        "circle"
    }
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.0 * self.0
    }
    fn name(&self) -> &'static str {
        "square"
    }
}

/// Static dispatch: monomorphised, inlinable, zero overhead.
fn describe_static(s: &impl Shape) -> String {
    s.report()
}

/// Dynamic dispatch: one compiled copy, works on a mixed collection.
fn total_area(shapes: &[Box<dyn Shape>]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

/// Returning different concrete types from different branches needs dyn.
fn make(kind: &str, size: f64) -> Box<dyn Shape> {
    match kind {
        "circle" => Box::new(Circle(size)),
        _ => Box::new(Square(size)),
    }
}

/// Ergonomic constructor: callers pass &str or String, no ceremony either way.
#[derive(Debug, Default, Clone, PartialEq)]
struct Label {
    text: String,
    weight: u16, // font weights go to 900, so u8 would not fit
}

impl Label {
    fn new(text: impl Into<String>) -> Self {
        Self { text: text.into(), weight: 400 }
    }
}

/// From gives Into for free. Implement this direction only.
struct Millimetres(f64);
struct Inches(f64);

impl From<Inches> for Millimetres {
    fn from(i: Inches) -> Self {
        Millimetres(i.0 * 25.4)
    }
}

/// An extension trait: adds a method to a foreign type without owning it.
trait Truncate {
    fn ellipsise(&self, max: usize) -> String;
}

impl Truncate for str {
    fn ellipsise(&self, max: usize) -> String {
        if self.chars().count() <= max {
            self.to_string()
        } else {
            format!("{}...", self.chars().take(max.saturating_sub(3)).collect::<String>())
        }
    }
}

/// A blanket impl: every Debug type gets this, exactly how ToString works.
trait Inspect {
    fn inspected(&self) -> String;
}

impl<T: Debug> Inspect for T {
    fn inspected(&self) -> String {
        format!("<{:?}>", self)
    }
}

/// The orphan rule workaround: wrap the foreign type to implement Display.
struct Csv(Vec<i32>);

impl Display for Csv {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let joined: Vec<String> = self.0.iter().map(|n| n.to_string()).collect();
        f.write_str(&joined.join(","))
    }
}

fn main() {
    println!("static:  {}", describe_static(&Circle(1.0)));
    println!("static:  {}", describe_static(&Square(2.0)));

    let mixed: Vec<Box<dyn Shape>> = vec![make("circle", 1.0), make("square", 2.0), make("x", 3.0)];
    for s in &mixed {
        println!("dynamic: {}", s.report());
    }
    println!("total area {:.2}", total_area(&mixed));

    // A fat pointer carries data plus vtable.
    println!(
        "&Circle = {} bytes, &dyn Shape = {} bytes",
        size_of::<&Circle>(),
        size_of::<&dyn Shape>()
    );

    // impl Into<String>: both call styles work.
    println!("{:?}", Label::new("borrowed"));
    println!("{:?}", Label::new(String::from("owned")));
    println!("{:?}", Label::default());

    // From and the free Into.
    println!("1 inch = {:.1}mm", Millimetres::from(Inches(1.0)).0);
    let mm: Millimetres = Inches(2.0).into();
    println!("2 inch = {:.1}mm", mm.0);

    // Extension trait on a foreign type.
    println!("{}", "a rather long sentence".ellipsise(12));
    println!("{}", "short".ellipsise(12));

    // Blanket impl: available on everything Debug.
    println!("{} {} {}", 42.inspected(), "hi".inspected(), vec![1, 2].inspected());

    // Newtype to get around the orphan rule.
    println!("{}", Csv(vec![3, 1, 4, 1, 5]));

    // Derived traits doing real work.
    let mut labels = vec![Label::new("b"), Label::new("a"), Label::new("c")];
    labels.sort_by(|x, y| x.text.cmp(&y.text));
    println!("{:?}", labels.iter().map(|l| &l.text).collect::<Vec<_>>());
    println!("equal? {}", Label::new("a") == Label::new("a"));
}`,
      exercise: {
        prompt:
          "Define an extension trait `Doubled` with a method `doubled(&self) -> i32`, implement it for `i32`, and print `doubled: 84` for `42`.",
        expect: { contains: ["doubled: 84"] },
        hint: "`trait Doubled { fn doubled(&self) -> i32; } impl Doubled for i32 { fn doubled(&self) -> i32 { self * 2 } }` — legal because you own the trait.",
      },
    },

    {
      slug: "ft-iterators-idiom",
      title: "Iterators and closures, the idiom",
      minutes: 6,
      summary:
        "The chains you will write every day, the Fn traits, and the `collect` calls you should delete.",
      tags: ["iterators", "closures", "collect"],
      body: md(
        "Idiomatic Rust leans hard on iterators. They are lazy, they fuse into a single loop, and they usually eliminate bounds checks — so the expressive version is also the fast one.",
        "",
        "## The chains worth memorising",
        "",
        "```rust",
        "xs.iter().filter(|x| ...).map(|x| ...).collect::<Vec<_>>()",
        "xs.iter().filter_map(|s| s.parse().ok())        // parse what you can",
        "xs.iter().flat_map(|s| s.split(','))            // map then flatten",
        "xs.iter().enumerate() / .zip(ys) / .rev()",
        "xs.iter().fold(init, |acc, x| ...)              // and .reduce for no init",
        "xs.iter().any(..) / .all(..) / .find(..) / .position(..)",
        "xs.iter().max_by_key(|x| ..) / .min_by(..)",
        "xs.iter().partition(..) / .unzip()",
        "xs.chunks(n) / .windows(n)                      // on slices",
        "```",
        "",
        "`collect` is driven by the target type, and it is cleverer than it looks: it can build a `String`, a `HashMap` from pairs, or — crucially — a `Result<Vec<T>, E>` from an iterator of `Result`, short-circuiting on the first error.",
        "",
        "## Delete these `collect` calls",
        "",
        "A `collect::<Vec<_>>()` in the middle of a chain allocates for no reason. Keep the chain lazy and collect once at the end — or not at all if a `sum`, `count` or `for` is the real consumer. `.iter().count()` on a slice is also just `.len()`.",
        "",
        "## Closures and the three Fn traits",
        "",
        "| Trait | Callable | Captures |",
        "|---|---|---|",
        "| `FnOnce` | once | may consume them |",
        "| `FnMut` | repeatedly, needs `mut` | may mutate them |",
        "| `Fn` | repeatedly | only reads |",
        "",
        "Rust captures as weakly as it can; `move` forces capture by value, which is what you need to send a closure to a thread or return it. In parameters, ask for the weakest trait that works — `impl Fn(..)` accepts fewer closures than `impl FnOnce(..)`.",
        "",
        "## When a `for` loop is better",
        "",
        "When the body is long, has early returns, or does several unrelated things. A four-adapter chain with a six-line closure is harder to read than the loop. Idiomatic does not mean maximal.",
        "",
        "> `rayon` turns `.iter()` into `.par_iter()` and parallelises the chain. That one-word change is the single best performance-to-effort ratio in the ecosystem.",
      ),
      code: `use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Employee {
    name: String,
    dept: String,
    salary: u32,
}

fn main() {
    let staff = vec![
        Employee { name: "ada".into(), dept: "eng".into(), salary: 120 },
        Employee { name: "bo".into(), dept: "ops".into(), salary: 90 },
        Employee { name: "cy".into(), dept: "eng".into(), salary: 140 },
        Employee { name: "di".into(), dept: "ops".into(), salary: 95 },
        Employee { name: "ed".into(), dept: "eng".into(), salary: 110 },
    ];

    // The everyday chain: lazy, fused into one loop, one allocation at the end.
    let senior: Vec<&str> = staff
        .iter()
        .filter(|e| e.salary > 100)
        .map(|e| e.name.as_str())
        .collect();
    println!("senior: {senior:?}");

    // No allocation at all when the consumer is an aggregate.
    println!("payroll: {}", staff.iter().map(|e| e.salary).sum::<u32>());
    println!("headcount in eng: {}", staff.iter().filter(|e| e.dept == "eng").count());
    println!("top earner: {:?}", staff.iter().max_by_key(|e| e.salary).map(|e| &e.name));
    println!("anyone underpaid? {}", staff.iter().any(|e| e.salary < 95));

    // filter_map: transform and discard failures in one pass.
    let raw = ["12", "x", "30", "", "8"];
    let nums: Vec<u32> = raw.iter().filter_map(|s| s.parse().ok()).collect();
    println!("parsed: {nums:?}");

    // collect into a Result: the first error short-circuits the whole chain.
    let all: Result<Vec<u32>, _> = ["1", "2"].iter().map(|s| s.parse::<u32>()).collect();
    let some: Result<Vec<u32>, _> = ["1", "x"].iter().map(|s| s.parse::<u32>()).collect();
    println!("all ok: {all:?} / had an error: {}", some.is_err());

    // Grouping: fold with a map is the idiom when you have no itertools.
    let by_dept: HashMap<&str, Vec<&str>> =
        staff.iter().fold(HashMap::new(), |mut acc, e| {
            acc.entry(e.dept.as_str()).or_default().push(e.name.as_str());
            acc
        });
    let mut depts: Vec<&&str> = by_dept.keys().collect();
    depts.sort();
    for d in depts {
        println!("  {d}: {:?}", by_dept[*d]);
    }

    // partition and unzip.
    let (high, low): (Vec<&Employee>, Vec<&Employee>) =
        staff.iter().partition(|e| e.salary >= 110);
    println!("{} high / {} low", high.len(), low.len());
    let (names, salaries): (Vec<&str>, Vec<u32>) =
        staff.iter().map(|e| (e.name.as_str(), e.salary)).unzip();
    println!("{names:?} {salaries:?}");

    // scan for a running total, windows for deltas.
    let running: Vec<u32> = salaries
        .iter()
        .scan(0, |acc, s| {
            *acc += s;
            Some(*acc)
        })
        .collect();
    println!("running: {running:?}");
    let deltas: Vec<i64> = salaries
        .windows(2)
        .map(|w| w[1] as i64 - w[0] as i64)
        .collect();
    println!("deltas:  {deltas:?}");

    // Closures and the Fn traits.
    let threshold = 100;
    let is_senior = |e: &Employee| e.salary > threshold; // Fn: only reads
    println!("senior count: {}", staff.iter().filter(|e| is_senior(e)).count());

    let mut seen = 0;
    let mut visit = |_: &Employee| {
        seen += 1; // FnMut: mutates a capture
        seen
    };
    staff.iter().for_each(|e| {
        visit(e);
    });
    println!("visited {seen}");

    let owned = String::from("report");
    let build = move || format!("{owned}.csv"); // move: takes ownership
    println!("{}", build());

    // Returning a closure needs impl Fn, since the type has no name.
    let raise = raiser(10);
    println!("after raise: {:?}", salaries.iter().map(|s| raise(*s)).collect::<Vec<u32>>());

    // Chains vs loops: use the loop when the body stops being one expression.
    let mut flagged = Vec::new();
    for e in &staff {
        if e.dept != "eng" {
            continue;
        }
        if e.salary > 130 {
            flagged.push(format!("{} is above band", e.name));
        }
    }
    println!("{flagged:?}");
}

fn raiser(pct: u32) -> impl Fn(u32) -> u32 {
    move |salary| salary + salary * pct / 100
}`,
      exercise: {
        prompt:
          "In a single iterator chain over `[\"4\", \"nine\", \"16\", \"25\"]`, parse what you can, keep the values above 10, and sum them. Print `sum: 41`.",
        expect: { contains: ["sum: 41"], sourceContains: ["filter_map"] },
        hint: "`xs.iter().filter_map(|s| s.parse::<i32>().ok()).filter(|n| *n > 10).sum::<i32>()` — no intermediate `collect`.",
      },
    },
  ],
};

const engineering = {
  id: "ft-engineering",
  n: 3,
  path: "fast",
  title: "Engineering decisions",
  summary:
    "API design, the concurrency decision tree, and what actually costs performance.",
  lessons: [
    {
      slug: "ft-api-design",
      title: "API design and naming conventions",
      minutes: 6,
      summary:
        "The conventions the compiler will not teach you, and which the whole ecosystem assumes you know.",
      tags: ["API", "conventions", "builder"],
      body: md(
        "## Naming, which is load-bearing",
        "",
        "These prefixes have agreed meanings. Breaking them actively misleads readers:",
        "",
        "| Prefix | Cost | Receiver | Example |",
        "|---|---|---|---|",
        "| `as_` | free, a view | `&self` | `str::as_bytes` |",
        "| `to_` | allocates / copies | `&self` | `str::to_string` |",
        "| `into_` | consumes the input | `self` | `String::into_bytes` |",
        "",
        "Also: `new` for the obvious constructor, `with_*` for variants, `try_*` for fallible versions, `iter` / `iter_mut` / `into_iter` for the three iteration forms, and `is_` / `has_` for predicates. Getters are named `foo()`, not `get_foo()`.",
        "",
        "Types and traits are `UpperCamelCase`; everything else is `snake_case`; constants and statics are `SCREAMING_SNAKE_CASE`. Modules are singular nouns. Traits are usually a verb or capability (`Read`, `Display`, `Iterator`).",
        "",
        "## Parameters",
        "",
        "- Take `&str` not `&String`, `&[T]` not `&Vec<T>`, `&Path` not `&PathBuf` — each accepts strictly more callers.",
        "- `impl Into<String>` / `impl AsRef<Path>` on public constructors removes `.to_string()` from every call site.",
        "- No boolean parameters; a two-variant enum reads at the call site and extends later.",
        "- Return `impl Iterator<Item = T>` instead of `Vec<T>` when the caller may not need all of it.",
        "",
        "## Builders",
        "",
        "Rust has no named or default arguments. For more than three or four options, a builder with chained `self`-consuming methods is the convention. For plain config structs, `#[derive(Default)]` plus `..Default::default()` is lighter and often enough.",
        "",
        "## Small things that matter",
        "",
        "- `#[must_use]` on anything whose result being dropped is a bug.",
        "- `#[non_exhaustive]` on public enums and structs so adding a variant or field later is not a breaking change.",
        "- Derive `Debug` on every public type. Omitting it is a papercut for every one of your users.",
        "- Document with `///`, and put a runnable example in it — doc tests are compiled and run by `cargo test`, so your examples cannot rot.",
        "",
        "> Read the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) once. It is a checklist, and an afternoon with it will save your users years of small frustrations.",
      ),
      code: `use std::fmt;

/// Builder: Rust has no default arguments, so this is the convention once a
/// constructor grows past a few parameters.
#[derive(Debug, Clone)]
struct Server {
    host: String,
    port: u16,
    workers: usize,
    tls: bool,
    logging: Logging,
}

/// An enum instead of a bool parameter: readable at the call site.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Logging {
    Off,
    Terse,
    Verbose,
}

#[derive(Debug, Clone)]
#[must_use = "a ServerBuilder does nothing until you call .build()"]
struct ServerBuilder {
    host: String,
    port: u16,
    workers: usize,
    tls: bool,
    logging: Logging,
}

impl Server {
    /// The obvious constructor is named new.
    fn builder(host: impl Into<String>) -> ServerBuilder {
        ServerBuilder {
            host: host.into(),
            port: 8080,
            workers: 4,
            tls: false,
            logging: Logging::Terse,
        }
    }
}

impl ServerBuilder {
    // with_* for variants; each consumes and returns self so calls chain.
    fn with_port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }
    fn with_workers(mut self, workers: usize) -> Self {
        self.workers = workers;
        self
    }
    fn with_tls(mut self) -> Self {
        self.tls = true;
        self
    }
    fn with_logging(mut self, logging: Logging) -> Self {
        self.logging = logging;
        self
    }
    fn build(self) -> Server {
        Server {
            host: self.host,
            port: self.port,
            workers: self.workers,
            tls: self.tls,
            logging: self.logging,
        }
    }
}

impl fmt::Display for Server {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let scheme = if self.tls { "https" } else { "http" };
        write!(f, "{scheme}://{}:{} ({} workers, {:?})", self.host, self.port, self.workers, self.logging)
    }
}

/// The as_/to_/into_ convention, demonstrated on one type.
#[derive(Debug, Clone)]
struct Document {
    body: String,
}

impl Document {
    fn new(body: impl Into<String>) -> Self {
        Self { body: body.into() }
    }

    /// as_: free, borrowed view. &self.
    fn as_str(&self) -> &str {
        &self.body
    }

    /// to_: allocates. &self, original survives.
    fn to_uppercase(&self) -> String {
        self.body.to_uppercase()
    }

    /// into_: consumes. self, original is gone.
    fn into_words(self) -> Vec<String> {
        self.body.split_whitespace().map(str::to_string).collect()
    }

    /// try_ for the fallible variant.
    fn try_first_number(&self) -> Result<i64, std::num::ParseIntError> {
        self.body.split_whitespace().next().unwrap_or("").parse()
    }

    /// Returning an iterator defers the work and the allocation to the caller.
    fn words(&self) -> impl Iterator<Item = &str> {
        self.body.split_whitespace()
    }

    /// is_ for predicates. Getters are foo(), never get_foo().
    fn is_empty(&self) -> bool {
        self.body.trim().is_empty()
    }
}

/// #[must_use] on a result the caller must not silently drop.
#[must_use]
fn checked_div(a: i32, b: i32) -> Option<i32> {
    if b == 0 {
        None
    } else {
        Some(a / b)
    }
}

/// #[non_exhaustive] keeps adding a variant from being a breaking change.
#[non_exhaustive]
#[derive(Debug)]
enum Event {
    Started,
    Stopped,
}

fn main() {
    let server = Server::builder("0.0.0.0")
        .with_port(443)
        .with_workers(16)
        .with_tls()
        .with_logging(Logging::Verbose)
        .build();
    println!("{server}");
    println!("defaults: {}", Server::builder("localhost").build());
    println!("quiet:    {}", Server::builder("127.0.0.1").with_logging(Logging::Off).build());

    let doc = Document::new("42 apples and 7 pears");
    println!("as_str (free):    {:?}", doc.as_str());
    println!("to_uppercase:     {:?}", doc.to_uppercase());
    println!("words (lazy):     {:?}", doc.words().take(2).collect::<Vec<_>>());
    println!("try_first_number: {:?}", doc.try_first_number());
    println!("is_empty:         {}", doc.is_empty());
    println!("into_words:       {:?}", doc.clone().into_words());

    // The parameter rules: one signature, many callers.
    println!("{}", summarise("a literal"));
    println!("{}", summarise(&String::from("a String")));
    println!("{}", total(&[1, 2, 3]));
    println!("{}", total(&vec![4, 5]));

    println!("{:?} {:?}", checked_div(10, 2), checked_div(1, 0));
    println!("{:?} then {:?}", Event::Started, Event::Stopped);
}

/// &str, not &String: accepts literals, Strings and slices alike.
fn summarise(s: &str) -> String {
    format!("{} chars", s.len())
}

/// &[T], not &Vec<T>: accepts arrays, Vecs and slices alike.
fn total(xs: &[i32]) -> i32 {
    xs.iter().sum()
}`,
      exercise: {
        prompt:
          "Give `Document` a method following the `as_` convention that returns the body's bytes as a borrowed slice with no allocation, and print its length so the output contains `bytes: 21`.",
        expect: { contains: ["bytes: 21"] },
        hint: "`fn as_bytes(&self) -> &[u8] { self.body.as_bytes() }` — `as_` means free and borrowed, which this is. `\"42 apples and 7 pears\"` is 21 bytes.",
      },
    },

    {
      slug: "ft-concurrency-decisions",
      title: "The concurrency decision tree",
      minutes: 6,
      summary:
        "Threads, rayon, channels, Arc<Mutex> or async — choosing correctly, and why async is often the wrong answer.",
      tags: ["threads", "rayon", "async", "Send"],
      body: md(
        "## Choose by workload, not by fashion",
        "",
        "| Situation | Reach for |",
        "|---|---|",
        "| CPU-bound work over a collection | **rayon**: `.iter()` → `.par_iter()` |",
        "| A handful of long-lived workers | `std::thread` + channels |",
        "| Borrowing locals from threads | `thread::scope` |",
        "| Shared counter or flag | `AtomicUsize` |",
        "| Shared mutable structure | `Arc<Mutex<T>>`, or `RwLock` if reads dominate |",
        "| Thousands of concurrent **IO** waits | `async` + tokio |",
        "| A CLI, a batch job, most programs | plain synchronous code |",
        "",
        "## Why the borrow checker is enough",
        "",
        "A data race requires two threads, one writing, and no synchronisation. Rule 2 of borrowing — many readers or one writer — already forbids that aliasing, so the *same* checker you have been fighting over `Vec` gives you thread safety. Two marker traits encode it, and both are inferred:",
        "",
        "- **`Send`** — ownership can move to another thread. `Rc<T>` is not (non-atomic count).",
        "- **`Sync`** — `&T` can be shared across threads. `RefCell<T>` is not (non-atomic borrow flag).",
        "",
        "Sending an `Rc` between threads is a compile error, not a Heisenbug.",
        "",
        "## What Rust does *not* prevent",
        "",
        "Deadlocks, livelocks, leaks and logic races are all still possible. Keep critical sections short, always acquire locks in a consistent order, and compute outside the lock.",
        "",
        "## The honest take on async",
        "",
        "`async` solves one problem: holding very many connections open cheaply. It costs you a runtime dependency, a split ecosystem (`std::fs` vs `tokio::fs`), harder debugging, and function colouring that spreads up the call graph.",
        "",
        "Two rules that prevent most async bugs:",
        "",
        "1. **Never block in async.** `thread::sleep`, a big computation, or sync IO stalls every task on that executor thread. Use `tokio::time::sleep`, or `spawn_blocking`.",
        "2. **Awaiting sequentially is not concurrency.** `a.await; b.await;` runs them one after the other. Use `join!`, `select!` or `tokio::spawn`.",
        "",
        "> If the work is CPU-bound, async buys you nothing and costs you plenty. Reach for rayon.",
      ),
      code: `use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::thread;

fn main() {
    // --- scoped threads: borrow locals, no Arc, no 'static, no move ---
    let samples: Vec<u64> = (1..=2_000).collect();
    let (lo, hi) = samples.split_at(samples.len() / 2);
    let (a, b) = thread::scope(|s| {
        let h1 = s.spawn(|| lo.iter().sum::<u64>());
        let h2 = s.spawn(|| hi.iter().sum::<u64>());
        (h1.join().unwrap(), h2.join().unwrap())
    });
    println!("scoped halves: {a} + {b} = {}", a + b);
    println!("samples still owned here: {} items", samples.len());

    // --- channels: ownership moves with the message, so nothing is shared ---
    let (tx, rx) = mpsc::channel();
    for id in 0..4 {
        let tx = tx.clone();
        thread::spawn(move || {
            let work: u64 = (1..=10_000u64).map(|n| n % (id + 2)).sum();
            tx.send((id, work)).unwrap();
        });
    }
    drop(tx); // crucial: the receiver loop ends only when ALL senders are gone
    let mut results: Vec<(u64, u64)> = rx.iter().collect();
    results.sort();
    println!("channel results: {results:?}");

    // --- Arc<Mutex<T>>: shared mutable state. Note the data is INSIDE the lock,
    //     so there is no way to touch it without holding the lock. ---
    let ledger = Arc::new(Mutex::new(Vec::<String>::new()));
    let mut handles = Vec::new();
    for id in 0..4 {
        let ledger = Arc::clone(&ledger);
        handles.push(thread::spawn(move || {
            // Compute outside the lock, hold it only to commit.
            let line = format!("worker {id} did {} units", (id + 1) * 100);
            ledger.lock().unwrap().push(line);
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    let mut lines = ledger.lock().unwrap().clone();
    lines.sort();
    println!("ledger: {} entries, first {:?}", lines.len(), lines[0]);

    // --- Atomics: far cheaper than a mutex for a single counter ---
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

    // --- RwLock: many concurrent readers, one writer ---
    let config = Arc::new(RwLock::new(vec!["default".to_string()]));
    let readers: Vec<_> = (0..3)
        .map(|id| {
            let config = Arc::clone(&config);
            thread::spawn(move || format!("reader {id} saw {} entries", config.read().unwrap().len()))
        })
        .collect();
    for r in readers {
        println!("  {}", r.join().unwrap());
    }
    config.write().unwrap().push("override".into());
    println!("after write: {:?}", config.read().unwrap());

    // --- Send/Sync are what make all of the above checked rather than hoped.
    //     Uncomment to watch the compiler refuse an Rc across a thread:
    //
    //     let shared = std::rc::Rc::new(1);
    //     thread::spawn(move || println!("{shared}"));
    //
    //     error: \`Rc<i32>\` cannot be sent between threads safely

    println!("i32 is Send: {}", is_send::<i32>());
    println!("Arc<Mutex<i32>> is Send: {}", is_send::<Arc<Mutex<i32>>>());
    println!("available parallelism: {:?}", thread::available_parallelism());
}

/// A compile-time question answered at compile time: this only builds for types
/// that really are Send.
fn is_send<T: Send>() -> bool {
    true
}`,
      exercise: {
        prompt:
          "Use `thread::scope` to sum the first and second halves of `vec![1, 2, 3, 4, 5, 6]` on two threads that **borrow** the vector (no `Arc`, no `move` of the data), and print `total: 21`.",
        expect: { contains: ["total: 21"], sourceContains: ["scope"] },
        hint: "`let (lo, hi) = v.split_at(3);` then spawn one scoped thread per half. `thread::scope` guarantees both finish before it returns, which is why borrowing is allowed.",
      },
    },

    {
      slug: "ft-performance-reality",
      title: "Performance: what is free and what is not",
      minutes: 5,
      summary:
        "Which abstractions genuinely cost nothing, where the real costs hide, and the five things to check first.",
      tags: ["performance", "allocation", "release"],
      body: md(
        "## Genuinely free",
        "",
        "Iterator chains, `Option`/`Result`, newtypes, generics and trait bounds, `impl Trait`, pattern matching, bounds checks the optimiser can prove. These compile to what you would have hand-written. Writing the expressive version costs nothing.",
        "",
        "## Not free, and easy to miss",
        "",
        "- **Allocation.** `String`, `Vec`, `Box`, `collect()`, `to_string()`, `format!` all allocate. Allocation in a hot loop is usually the whole problem.",
        "- **`clone()` on an owning type.** Deep copy. Cheap for `Copy` types, not for a `Vec<String>`.",
        "- **`Arc` / `Rc` clones** — atomic increments, contended across threads.",
        "- **`Box<dyn Trait>`** — a vtable call that blocks inlining.",
        "- **`Mutex` contention** — often worse than the work it protects.",
        "- **`HashMap`'s default hasher**, which is DoS-resistant and therefore not the fastest. `rustc_hash::FxHashMap` is much quicker for internal, non-adversarial keys.",
        "",
        "## The five things to check first",
        "",
        "1. **Are you in release mode?** Debug builds are routinely 10–50× slower. Benchmarking a debug build is the most common mistake there is.",
        "2. **Reserve capacity.** `Vec::with_capacity(n)` / `String::with_capacity(n)` removes a cascade of reallocations.",
        "3. **Delete intermediate `collect`s.** Keep the chain lazy until the end.",
        "4. **Borrow instead of cloning** in hot paths — take `&str`, return `&[T]`, use `Cow<'_, str>` when a function usually borrows but occasionally owns.",
        "5. **Try `rayon`.** `.par_iter()` on an embarrassingly parallel loop is often a one-word speedup.",
        "",
        "## Measure, do not guess",
        "",
        "`criterion` for benchmarks, `cargo flamegraph` for profiles, `hyperfine` for whole-program timing. Rust's performance intuitions are unusually unreliable because the optimiser is aggressive — code you expect to be slow is often free, and the real cost is an allocation you did not notice.",
        "",
        "> `#[inline]` is rarely the answer, and `unsafe` for performance almost never is. Both come after a profile, not before.",
      ),
      code: `use std::borrow::Cow;
use std::time::Instant;

fn main() {
    // NOTE: this is a debug build by default. Flip the toolbar to "release"
    // and run again — the gap is the single most important number here.
    let n = 200_000;

    // 1. Preallocating removes a cascade of reallocations.
    let t = Instant::now();
    let mut grown: Vec<usize> = Vec::new();
    for i in 0..n {
        grown.push(i);
    }
    let grow_time = t.elapsed();

    let t = Instant::now();
    let mut reserved: Vec<usize> = Vec::with_capacity(n);
    for i in 0..n {
        reserved.push(i);
    }
    let reserve_time = t.elapsed();
    println!("push {n}: growing {grow_time:?} vs reserved {reserve_time:?}");

    // 2. An intermediate collect allocates a whole Vec for nothing.
    let t = Instant::now();
    let wasteful: usize = grown
        .iter()
        .map(|x| x * 2)
        .collect::<Vec<usize>>() // <- this allocation is pure waste
        .iter()
        .filter(|x| *x % 3 == 0)
        .sum();
    let wasteful_time = t.elapsed();

    let t = Instant::now();
    let lazy: usize = grown.iter().map(|x| x * 2).filter(|x| x % 3 == 0).sum();
    let lazy_time = t.elapsed();
    println!("same answer ({}): collect {wasteful_time:?} vs lazy {lazy_time:?}",
             wasteful == lazy);

    // 3. Cloning owned data vs borrowing it.
    let words: Vec<String> = (0..20_000).map(|i| format!("word{i}")).collect();

    let t = Instant::now();
    let cloned: usize = words.iter().map(|w| w.clone()).map(|w| w.len()).sum();
    let clone_time = t.elapsed();

    let t = Instant::now();
    let borrowed: usize = words.iter().map(|w| w.len()).sum();
    let borrow_time = t.elapsed();
    println!("same answer ({}): clone {clone_time:?} vs borrow {borrow_time:?}",
             cloned == borrowed);

    // 4. Cow: borrow in the common case, allocate only when you must.
    for input in ["already clean", "has  double  spaces"] {
        let out = normalise(input);
        let kind = match out {
            Cow::Borrowed(_) => "borrowed (no allocation)",
            Cow::Owned(_) => "owned (allocated)",
        };
        println!("{input:?} -> {out:?} [{kind}]");
    }

    // 5. Static vs dynamic dispatch, for intuition rather than a microbenchmark.
    let shapes: Vec<Box<dyn Area>> = vec![Box::new(Sq(2.0)), Box::new(Ci(1.0))];
    let dynamic: f64 = shapes.iter().map(|s| s.area()).sum();
    let statics: f64 = area_of(&Sq(2.0)) + area_of(&Ci(1.0));
    println!("dyn {dynamic:.3} == static {statics:.3}: {}", (dynamic - statics).abs() < 1e-9);

    // Sizes are worth knowing: Option<Box<T>> costs nothing extra, because the
    // null pointer is used as the None tag.
    println!("Box<i32>         {} bytes", size_of::<Box<i32>>());
    println!("Option<Box<i32>> {} bytes (niche optimisation)", size_of::<Option<Box<i32>>>());
    println!("&dyn Area        {} bytes (fat pointer)", size_of::<&dyn Area>());
}

/// Cow borrows when nothing changed, and allocates only when it must.
fn normalise(input: &str) -> Cow<'_, str> {
    if input.contains("  ") {
        Cow::Owned(input.split_whitespace().collect::<Vec<_>>().join(" "))
    } else {
        Cow::Borrowed(input)
    }
}

trait Area {
    fn area(&self) -> f64;
}
struct Sq(f64);
struct Ci(f64);
impl Area for Sq {
    fn area(&self) -> f64 {
        self.0 * self.0
    }
}
impl Area for Ci {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.0 * self.0
    }
}

/// Static dispatch: monomorphised and inlinable.
fn area_of(s: &impl Area) -> f64 {
    s.area()
}`,
      exercise: {
        prompt:
          "Rewrite `let v: Vec<u64> = (0..50_000).map(|i| i * 2).collect::<Vec<_>>().iter().filter(|x| *x % 3 == 0).copied().collect();` as one lazy chain with no intermediate `collect`, and print the length as `kept: 16667`.",
        expect: { contains: ["kept: 16667"] },
        hint: "`let v: Vec<u64> = (0..50_000u64).map(|i| i * 2).filter(|x| x % 3 == 0).collect();` — one allocation instead of two.",
      },
    },
  ],
};

const shipping = {
  id: "ft-shipping",
  n: 4,
  path: "fast",
  title: "Shipping it",
  summary:
    "The toolchain you get for free, and the mistakes that cost everyone their first week.",
  lessons: [
    {
      slug: "ft-tooling",
      title: "Cargo and the toolchain",
      minutes: 4,
      summary:
        "The commands, lints and project hygiene that every Rust codebase assumes.",
      tags: ["cargo", "clippy", "features", "CI"],
      body: md(
        "Rust's tooling is uniformly good and largely non-optional in practice — teams expect it.",
        "",
        "## The commands",
        "",
        "```bash",
        "cargo new / init            # start",
        "cargo build / build --release",
        "cargo run -- --args",
        "cargo check                 # type-check only: much faster, use it in your edit loop",
        "cargo test                  # unit + integration + DOC tests",
        "cargo fmt                   # rustfmt; non-negotiable, zero config debates",
        "cargo clippy -- -D warnings # ~700 lints; treat them as errors in CI",
        "cargo doc --open            # your docs, rendered",
        "cargo add serde --features derive",
        "cargo update / tree / bench",
        "```",
        "",
        "Worth installing: `cargo-watch` (rerun on save), `cargo-expand` (see macro output), `cargo-audit` and `cargo-deny` (vulnerabilities and licence policy), `cargo-nextest` (faster test runner), `cargo-flamegraph`.",
        "",
        "## Doc tests are the headline feature",
        "",
        "Code blocks inside `///` comments are compiled and executed by `cargo test`. Your documentation examples cannot silently rot. Almost no other ecosystem has this, and it is badly underused.",
        "",
        "## Project hygiene",
        "",
        "- **Features** are additive. `default = [...]`, and optional dependencies become features automatically. Never make a feature *remove* functionality — with feature unification, someone else enabling it will break you.",
        "- **Workspaces** for multi-crate projects: one `Cargo.lock`, one `target/`, shared dependency versions via `[workspace.dependencies]`.",
        "- **Commit `Cargo.lock`** for binaries; for libraries it is now also recommended, as it only affects your own CI.",
        "- **MSRV**: declare `rust-version` in `Cargo.toml` if you support older compilers.",
        "- **SemVer** is taken seriously here. `cargo-semver-checks` catches accidental breakage.",
        "",
        "## A CI baseline",
        "",
        "```bash",
        "cargo fmt --check",
        "cargo clippy --all-targets --all-features -- -D warnings",
        "cargo test --all-features",
        "```",
        "",
        "> Read clippy's suggestions rather than silencing them. A large share of them are teaching you an idiom you did not know existed — it is the fastest unsupervised way to improve.",
      ),
      code: `//! Crate-level docs use //! and appear on the crate's front page.
//!
//! This snippet runs in test mode, so the Run button executes the test harness
//! below — including what cargo test would do with doc tests.

// Only needed on the playground, which has no Cargo.toml to declare the
// "extras" feature referenced further down.
#![allow(unexpected_cfgs)]

/// Returns the nth triangular number.
///
/// # Examples
///
/// The block below is a doc test: cargo test compiles AND runs it, so this
/// example cannot drift out of sync with the code.
///
/// \`\`\`
/// assert_eq!(playground::triangular(4), 10);
/// \`\`\`
///
/// # Panics
///
/// Documenting panics and errors is conventional, and clippy can enforce it.
pub fn triangular(n: u32) -> u32 {
    (1..=n).sum()
}

/// Parses a "key=value" pair.
///
/// # Errors
///
/// Returns the input back as an error when there is no \`=\`.
pub fn parse_pair(s: &str) -> Result<(&str, &str), &str> {
    s.split_once('=')
        .map(|(k, v)| (k.trim(), v.trim()))
        .ok_or(s)
}

/// Feature flags are additive. This function only exists when the feature is
/// enabled; on the playground it is always compiled out.
#[cfg(feature = "extras")]
pub fn only_with_extras() -> &'static str {
    "extras enabled"
}

/// cfg! is the runtime form, useful for diagnostics.
pub fn build_profile() -> &'static str {
    if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn triangular_numbers() {
        assert_eq!(triangular(0), 0);
        assert_eq!(triangular(1), 1);
        assert_eq!(triangular(4), 10);
    }

    /// Table-driven tests name the failing case for you.
    #[test]
    fn parses_pairs() {
        let cases = [
            ("a=1", Ok(("a", "1"))),
            (" key = value ", Ok(("key", "value"))),
            ("nope", Err("nope")),
        ];
        for (input, expected) in cases {
            assert_eq!(parse_pair(input), expected, "input was {input:?}");
        }
    }

    /// A test returning Result lets you use ? on fallible setup.
    #[test]
    fn question_mark_in_tests() -> Result<(), std::num::ParseIntError> {
        let n: u32 = "7".parse()?;
        assert_eq!(triangular(n), 28);
        Ok(())
    }

    #[test]
    #[should_panic(expected = "deliberate")]
    fn panics_are_testable() {
        panic!("deliberate failure");
    }

    #[test]
    fn reports_its_profile() {
        // The playground builds tests in debug, so this holds here.
        assert_eq!(build_profile(), "debug");
    }
}`,
      tests: true,
      exercise: {
        prompt:
          "Add a test named `large_triangular` asserting that `triangular(100) == 5050`, then run the suite. The output should report `0 failed`.",
        expect: { contains: ["0 failed"] },
        hint: "Inside `mod tests`:\n\n```rust\n#[test]\nfn large_triangular() {\n    assert_eq!(triangular(100), 5050);\n}\n```",
      },
    },

    {
      slug: "ft-common-mistakes",
      title: "The mistakes that cost everyone their first week",
      minutes: 4,
      summary:
        "Twelve habits from other languages that Rust punishes — and the capstone exercise.",
      tags: ["pitfalls", "review", "capstone"],
      body: md(
        "Every one of these is something experienced programmers do in their first Rust week.",
        "",
        "1. **`clone()` to silence the borrow checker.** It compiles, and it hides an ownership design you have not thought through. Ask who owns the value first; clone deliberately, not reflexively.",
        "2. **`Rc<RefCell<T>>` everywhere.** You have ported a garbage-collected object graph. Most of the time a tree plus indices, or passing `&mut` down, is simpler, faster and checked at compile time.",
        "3. **`unwrap()` in library code.** Fine in tests and examples. In a service it is a panic waiting for the right input. At minimum use `expect(\"why I expected this\")`.",
        "4. **`&String`, `&Vec<T>`, `&PathBuf` parameters.** Always `&str`, `&[T]`, `&Path` — they accept strictly more callers at no cost.",
        "5. **Reaching for `unsafe` to get past an error.** `unsafe` does not relax the borrow checker. It unlocks five specific operations, and hands you the entire burden of proof.",
        "6. **Premature `async`.** It is for very many concurrent IO waits. For CPU work use rayon; for a CLI, use nothing.",
        "7. **Blocking inside async.** `thread::sleep` or a heavy computation stalls every task on that executor thread.",
        "8. **Awaiting sequentially and calling it concurrency.** `a.await; b.await;` is strictly serial. You wanted `join!`.",
        "9. **Over-generic code.** Three type parameters and five bounds on a function with one caller. Write it concrete; generalise when the second caller actually arrives.",
        "10. **Stringly-typed errors.** `Err(String)` forces every caller into string matching. Use an enum.",
        "11. **Fighting instead of reading.** Rust's errors name the binding, point at the move *and* the later use, and usually print the fix. They are better than most languages' documentation.",
        "12. **Silencing clippy.** Those lints are a free senior reviewer. Read the explanation before adding `#[allow]`.",
        "",
        "## Where to go next",
        "",
        "- *The Rust Book* for depth, *Rust by Example* for breadth, *Rustlings* for drills.",
        "- *The Rust API Guidelines* — one afternoon, permanent payoff.",
        "- *Rust for Rustaceans* (Gjengset) once you are past this hour. It is the best second book.",
        "- Then read real code: `std`, `serde`, `ripgrep`, `tokio`.",
        "",
        "> The hour is up. The thing that will actually make you fluent is writing a small real program — a CLI, a parser, a scraper — and letting the compiler argue with you for a weekend.",
      ),
      code: `#![allow(dead_code)]
use std::collections::HashMap;
use std::fmt;

// ---- 4. Parameter types: take the borrowed, flexible form ----

// Weak: only a &String works.          fn shout(s: &String) -> String
// Strong: literals, Strings and slices all work.
fn shout(s: &str) -> String {
    s.to_uppercase()
}

// Weak: fn total(v: &Vec<i32>) -> i32
// Strong: arrays, Vecs and slices all work.
fn total(xs: &[i32]) -> i32 {
    xs.iter().sum()
}

// ---- 10. Errors: an enum, not a String ----

#[derive(Debug, PartialEq)]
enum ParseError {
    Empty,
    NotANumber { token: String },
    Negative(i64),
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ParseError::Empty => write!(f, "input was empty"),
            ParseError::NotANumber { token } => write!(f, "{token:?} is not a number"),
            ParseError::Negative(n) => write!(f, "{n} is negative"),
        }
    }
}

/// Callers can match on the case AND get the data — impossible with Err(String).
fn parse_positive(input: &str) -> Result<u64, ParseError> {
    let token = input.trim();
    if token.is_empty() {
        return Err(ParseError::Empty);
    }
    let n: i64 = token
        .parse()
        .map_err(|_| ParseError::NotANumber { token: token.to_string() })?;
    u64::try_from(n).map_err(|_| ParseError::Negative(n))
}

// ---- 1 & 2. Ownership design instead of clone() and Rc<RefCell<..>> ----

/// Reflex: clone the whole map to read one value.
fn lookup_cloning(map: &HashMap<String, u32>, key: &str) -> u32 {
    let copy = map.clone(); // a whole-map deep copy, for one lookup
    copy.get(key).copied().unwrap_or(0)
}

/// Considered: borrow, and copy out only the small value.
fn lookup_borrowing(map: &HashMap<String, u32>, key: &str) -> u32 {
    map.get(key).copied().unwrap_or(0)
}

/// A tree with indices rather than Rc<RefCell<Node>>: no cycles, no runtime
/// borrow panics, still Send, and faster.
#[derive(Default, Debug)]
struct Tree {
    nodes: Vec<Node>,
}

#[derive(Debug)]
struct Node {
    label: String,
    parent: Option<usize>,
}

impl Tree {
    fn add(&mut self, label: &str, parent: Option<usize>) -> usize {
        self.nodes.push(Node { label: label.to_string(), parent });
        self.nodes.len() - 1
    }
    fn path_to_root(&self, mut id: usize) -> Vec<&str> {
        let mut path = vec![self.nodes[id].label.as_str()];
        while let Some(parent) = self.nodes[id].parent {
            path.push(self.nodes[parent].label.as_str());
            id = parent;
        }
        path
    }
}

// ---- 9. Concrete beats over-generic until a second caller exists ----

/// Over-generic for one call site: three parameters, four bounds, no benefit.
fn over_generic<T, U, V>(a: T, b: U) -> String
where
    T: fmt::Debug + Clone,
    U: Into<V>,
    V: fmt::Debug,
{
    format!("{a:?} {:?}", b.into())
}

/// What you should have written.
fn concrete(a: &str, b: u32) -> String {
    format!("{a} {b}")
}

fn main() {
    // 4.
    println!("{} / {}", shout("a literal"), shout(&String::from("a String")));
    println!("{} / {}", total(&[1, 2, 3]), total(&vec![4, 5, 6]));

    // 10. Structured errors let callers react specifically.
    for input in ["42", "", "abc", "-7"] {
        match parse_positive(input) {
            Ok(n) => println!("{input:?} -> {n}"),
            Err(ParseError::Negative(n)) => println!("{input:?} -> negative, using {}", n.abs()),
            Err(e) => println!("{input:?} -> {e}"),
        }
    }

    // 1. Same answer, very different cost.
    let mut map = HashMap::new();
    for i in 0..1_000 {
        map.insert(format!("key{i}"), i);
    }
    println!(
        "cloning {} == borrowing {}",
        lookup_cloning(&map, "key7"),
        lookup_borrowing(&map, "key7")
    );

    // 2. An arena tree, with none of the Rc<RefCell<..>> machinery.
    let mut tree = Tree::default();
    let root = tree.add("root", None);
    let src = tree.add("src", Some(root));
    let main_rs = tree.add("main.rs", Some(src));
    println!("path: {:?}", tree.path_to_root(main_rs));

    // 9.
    println!("{}", concrete("concrete", 1));
    println!("{}", over_generic::<&str, u32, u32>("generic", 1));

    // 3. The alternatives to unwrap(), in order of preference.
    let maybe: Option<u32> = None;
    println!("unwrap_or         {}", maybe.unwrap_or(0));
    println!("unwrap_or_else    {}", maybe.unwrap_or_else(|| total(&[1, 2])as u32));
    println!("unwrap_or_default {}", maybe.unwrap_or_default());
    println!("ok_or             {:?}", maybe.ok_or(ParseError::Empty));

    // 11. The errors are documentation. Uncomment any of these and read them:
    //
    //   let s = String::from("x"); let t = s; println!("{s}");   // E0382
    //   let mut v = vec![1]; let r = &v[0]; v.push(2); println!("{r}"); // E0502
    //   fn bad() -> &str { &String::from("x") }                  // E0106
}`,
      exercise: {
        prompt:
          "**Capstone.** Write a function `fn summarise(raw: &[&str]) -> (Vec<u64>, Vec<String>)` that parses each entry with `parse_positive`, returning the successes and the formatted error messages. Call it with `[\"10\", \"x\", \"20\", \"-3\"]` and print the two counts as `ok: 2, failed: 2`.\n\nIt should use a borrowed slice parameter, a structured error, and one iterator pass — the three habits from this hour.",
        expect: { contains: ["ok: 2, failed: 2"] },
        hint: "`let (oks, errs): (Vec<_>, Vec<_>) = raw.iter().map(|s| parse_positive(s)).partition(|r| r.is_ok());` then map each side into its final form with `.map(|r| r.unwrap())` and `.map(|r| r.unwrap_err().to_string())`.",
      },
    },
  ],
};

export default [coreModel, idiomatic, engineering, shipping];
