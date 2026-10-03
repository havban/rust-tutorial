import { md } from "./_util.js";

export default {
  id: "structs-enums",
  n: 4,
  title: "Structs, enums & pattern matching",
  summary:
    "Modelling your own data: structs and methods, enums and Option, and patterns in depth.",
  lessons: [
    {
      slug: "structs",
      title: "Structs",
      summary: "Named fields, tuple structs, unit structs, and the update syntax.",
      tags: ["struct", "derive", "field init"],
      body: md(
        "A struct is a named group of named fields — a tuple whose parts have meaning.",
        "",
        "```rust",
        "struct User {",
        "    name: String,",
        "    active: bool,",
        "}",
        "let u = User { name: String::from(\"ada\"), active: true };",
        "```",
        "",
        "Field order does not matter when constructing. The whole struct is mutable or not; there is no per-field `mut`.",
        "",
        "## Three flavours",
        "",
        "- **Named-field** structs, as above. The default choice.",
        "- **Tuple structs**: `struct Meters(f64);` — fields accessed as `.0`. Ideal for a *newtype*, wrapping a primitive so the type system can tell metres from feet.",
        "- **Unit structs**: `struct Marker;` — no data at all. Useful for implementing a trait on something that carries no state.",
        "",
        "## Conveniences",
        "",
        "- **Field init shorthand**: when a local variable has the same name as the field, `User { name, active }` suffices.",
        "- **Struct update syntax**: `User { active: false, ..other }` fills the remaining fields from `other`. Note it *moves* non-`Copy` fields out of `other`.",
        "- **Derives**: `#[derive(Debug, Clone, PartialEq)]` generates the obvious implementations. `Debug` is what lets you print with `{:?}`, and you will want it on nearly everything.",
        "",
        "Ownership applies per field: a struct owning a `String` owns that heap buffer and drops it with the struct.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

#[derive(Debug, Clone, PartialEq)]
struct User {
    username: String,
    email: String,
    sign_in_count: u64,
    active: bool,
}

/// Tuple struct — a newtype, so metres cannot be mixed up with feet.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
struct Meters(f64);

#[derive(Debug, Clone, Copy)]
struct Feet(f64);

/// Unit struct: no data, exists purely as a type.
#[derive(Debug)]
struct AlwaysEqual;

fn main() {
    let mut user1 = User {
        email: String::from("ada@example.com"),
        username: String::from("ada"),
        active: true,
        sign_in_count: 1,
    };

    println!("{user1:?}");
    println!("pretty:\\n{user1:#?}");

    // The whole struct is mut, so any field can change.
    user1.sign_in_count += 1;
    user1.email = String::from("ada@lovelace.dev");
    println!("{} has signed in {} times", user1.username, user1.sign_in_count);

    // Field init shorthand.
    let user2 = build_user(String::from("bo"), String::from("bo@example.com"));
    println!("{user2:?}");

    // Update syntax: take the rest from user2.
    let user3 = User {
        username: String::from("cy"),
        ..user2.clone()
    };
    println!("{user3:?}");

    // Derived PartialEq gives us ==.
    println!("user2 == user3? {}", user2 == user3);

    // Newtypes keep units straight at compile time.
    let height = Meters(1.82);
    let depth = Meters(3.5);
    println!("{height:?} < {depth:?}? {}", height < depth);
    println!("in feet: {:?}", to_feet(height));
    // to_feet(Feet(6.0)); // <-- uncomment: Feet is not Meters

    let _marker = AlwaysEqual;

    // Structs nest.
    let rect = Rect { origin: Point { x: 0, y: 0 }, w: 4, h: 3 };
    println!("{rect:?} area {}", rect.w * rect.h);
}

#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

#[derive(Debug)]
struct Rect {
    origin: Point,
    w: u32,
    h: u32,
}

fn build_user(username: String, email: String) -> User {
    User {
        username, // shorthand for username: username
        email,
        active: true,
        sign_in_count: 0,
    }
}

fn to_feet(m: Meters) -> Feet {
    Feet(m.0 * 3.280_84)
}`,
      exercise: {
        prompt:
          "Define a struct `Book` with fields `title: String` and `pages: u32`, derive `Debug`, create one for `\"Dune\"` with 412 pages, and print it with `{:?}` so the output contains `pages: 412`.",
        expect: { contains: ["pages: 412"] },
        hint: "`#[derive(Debug)] struct Book { title: String, pages: u32 }` then `println!(\"{:?}\", Book { title: \"Dune\".to_string(), pages: 412 });`",
      },
    },

    {
      slug: "methods",
      title: "Methods and associated functions",
      summary:
        "`impl` blocks, the three forms of `self`, and the constructor convention.",
      tags: ["impl", "self", "&self", "new"],
      body: md(
        "Behaviour lives in an `impl` block, separate from the data definition:",
        "",
        "```rust",
        "impl Rect {",
        "    fn area(&self) -> u32 { self.w * self.h }",
        "}",
        "rect.area()",
        "```",
        "",
        "## Choosing a receiver",
        "",
        "The first parameter decides how the method relates to ownership, and this choice is the API:",
        "",
        "| Receiver | Means | Use for |",
        "|---|---|---|",
        "| `&self` | borrow immutably | reading — the common case |",
        "| `&mut self` | borrow mutably | modifying in place |",
        "| `self` | take ownership | consuming conversions, builders |",
        "",
        "`&self` is shorthand for `self: &Self`, and `Self` is an alias for the type being implemented.",
        "",
        "## Associated functions",
        "",
        "A function in an `impl` block *without* a `self` parameter is an associated function, called as `Type::func()`. `String::from` and `Vec::new` are exactly this. By convention a constructor is called `new` — there is no special constructor syntax, and no compiler magic involved.",
        "",
        "## Auto-referencing",
        "",
        "You write `rect.area()`, not `(&rect).area()`. Rust inserts the `&`, `&mut` or `*` needed to match the receiver. This is why method calls feel the same whether you hold a value, a reference, or a `Box`.",
        "",
        "> Methods can be split across several `impl` blocks for the same type, which is handy once generics and trait bounds enter the picture.",
      ),
      code: `#[derive(Debug, Clone, Copy, PartialEq)]
struct Rect {
    width: u32,
    height: u32,
}

impl Rect {
    /// Associated function (no self): the conventional constructor.
    fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }

    fn square(side: u32) -> Self {
        Self::new(side, side)
    }

    /// &self: reads, does not modify, does not consume.
    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn perimeter(&self) -> u32 {
        2 * (self.width + self.height)
    }

    fn is_square(&self) -> bool {
        self.width == self.height
    }

    fn can_hold(&self, other: &Rect) -> bool {
        self.width > other.width && self.height > other.height
    }

    /// &mut self: modifies in place.
    fn scale(&mut self, factor: u32) -> &mut Self {
        self.width *= factor;
        self.height *= factor;
        self // returning &mut Self allows chaining
    }

    /// self: consumes the value, producing something new.
    fn into_square(self) -> Rect {
        let side = self.width.max(self.height);
        Rect::new(side, side)
    }
}

fn main() {
    let r1 = Rect::new(30, 50);
    println!("{r1:?}");
    println!("area {} perimeter {}", r1.area(), r1.perimeter());
    println!("square? {}", r1.is_square());

    let r2 = Rect::new(10, 40);
    println!("r1 can hold r2? {}", r1.can_hold(&r2));
    println!("r2 can hold r1? {}", r2.can_hold(&r1));

    let sq = Rect::square(7);
    println!("{sq:?} square? {}", sq.is_square());

    // &mut self methods need a mut binding, and can be chained.
    let mut r3 = Rect::new(2, 3);
    r3.scale(2).scale(5);
    println!("scaled: {r3:?} area {}", r3.area());

    // A self method consumes the receiver.
    let grown = r2.into_square();
    println!("{grown:?}");
    // r2 is Copy here so it survives; without Copy this would be a move.

    // Auto-referencing: all three of these work.
    let r4 = Rect::new(1, 2);
    let by_ref = &r4;
    println!("{} {} {}", r4.area(), by_ref.area(), (&&r4).area());
}`,
      exercise: {
        prompt:
          "Give a `struct Counter { n: u32 }` an associated function `new()` starting at 0 and a method `bump(&mut self)` that adds 1. Call `bump` three times and print `count: 3`.",
        expect: { contains: ["count: 3"] },
        hint: "`impl Counter { fn new() -> Self { Self { n: 0 } } fn bump(&mut self) { self.n += 1; } }`",
      },
    },

    {
      slug: "enums",
      title: "Enums",
      summary:
        "Types that are exactly one of several shapes — and why they are more powerful than they look.",
      tags: ["enum", "variants", "data-carrying"],
      body: md(
        "An enum enumerates the possible forms a value may take. Unlike C enums, **each variant can carry its own data, of its own shape**:",
        "",
        "```rust",
        "enum Message {",
        "    Quit,                        // no data",
        "    Move { x: i32, y: i32 },     // named fields, like a struct",
        "    Write(String),               // one value",
        "    Colour(u8, u8, u8),          // a tuple",
        "}",
        "```",
        "",
        "That makes an enum a **sum type**: a value is exactly one variant, never two, never none. Compare the alternative in many languages — a struct with four optional fields and a comment explaining which combinations are legal. The enum makes the illegal combinations unrepresentable.",
        "",
        "Enums get `impl` blocks and methods just like structs.",
        "",
        "## Where this pays off",
        "",
        "Paired with `match`'s exhaustiveness check, enums are how Rust models anything with cases: `Option` for maybe-a-value, `Result` for success-or-failure, state machines, parse trees, protocol messages. Add a variant and the compiler walks you through every place that must now handle it.",
        "",
        "A `match` on an enum is also how you *get the data back out* of a variant — the pattern destructures it.",
        "",
        "> `enum`s are sized to their largest variant plus a discriminant, and the compiler is clever about it: `Option<Box<T>>` is the same size as `Box<T>`, using the null pointer as the `None` tag.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

#[derive(Debug)]
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColour(u8, u8, u8),
}

impl Message {
    /// Enums have methods just like structs.
    fn describe(&self) -> String {
        match self {
            Message::Quit => "shutting down".to_string(),
            Message::Move { x, y } => format!("moving to ({x}, {y})"),
            Message::Write(text) => format!("writing {text:?} ({} chars)", text.len()),
            Message::ChangeColour(r, g, b) => format!("colour #{r:02x}{g:02x}{b:02x}"),
        }
    }

    fn is_terminal(&self) -> bool {
        matches!(self, Message::Quit)
    }
}

/// A classic C-style enum, with explicit discriminants.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Status {
    Active = 1,
    Suspended = 2,
    Closed = 3,
}

/// A state machine where illegal states simply cannot be built.
#[derive(Debug)]
enum Connection {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session: String },
    Failed(String),
}

fn main() {
    let inbox = vec![
        Message::Write(String::from("hello")),
        Message::Move { x: 10, y: -4 },
        Message::ChangeColour(255, 128, 0),
        Message::Quit,
    ];

    for msg in &inbox {
        println!("{:<28} {}", format!("{msg:?}"), msg.describe());
    }
    println!("terminal messages: {}", inbox.iter().filter(|m| m.is_terminal()).count());

    // C-style enums can be cast to their discriminant.
    let s = Status::Suspended;
    println!("{s:?} = {}", s as i32);
    println!("active? {}", s == Status::Active);

    // Driving a state machine: each step returns the next state.
    let mut conn = Connection::Disconnected;
    for _ in 0..5 {
        println!("{conn:?}");
        conn = advance(conn);
    }
}

fn advance(state: Connection) -> Connection {
    match state {
        Connection::Disconnected => Connection::Connecting { attempt: 1 },
        Connection::Connecting { attempt } if attempt < 3 => {
            Connection::Connecting { attempt: attempt + 1 }
        }
        Connection::Connecting { .. } => {
            Connection::Connected { session: String::from("sess-42") }
        }
        Connection::Connected { session } => Connection::Connected { session },
        Connection::Failed(why) => Connection::Failed(why),
    }
}`,
      exercise: {
        prompt:
          "Define `enum Shape` with variants `Circle(f64)` and `Square(f64)`, and a method `area(&self) -> f64` using `match`. Print the area of `Shape::Square(3.0)` so the output contains `area: 9`.",
        expect: { contains: ["area: 9"] },
        hint: "`Shape::Circle(r) => 3.14159 * r * r, Shape::Square(s) => s * s`. Then `println!(\"area: {}\", Shape::Square(3.0).area());`",
      },
    },

    {
      slug: "option",
      title: "Option — no null, ever",
      summary:
        "How Rust represents absence, and the combinators that make it pleasant.",
      tags: ["Option", "Some", "None", "unwrap_or"],
      body: md(
        "Rust has no `null`. Instead, the possibility of absence is part of the type:",
        "",
        "```rust",
        "enum Option<T> { Some(T), None }",
        "```",
        "",
        "That is an ordinary enum from the standard library, with no special privileges beyond being in the prelude. Yet it removes an entire category of crash, because **a `T` can never be absent** — only an `Option<T>` can. The compiler will not let you use an `Option<i32>` as a number without first dealing with the `None` case.",
        "",
        "## Getting at the value",
        "",
        "From safest to sharpest:",
        "",
        "- `match` / `if let` — handle both cases explicitly.",
        "- `unwrap_or(default)`, `unwrap_or_else(|| ...)`, `unwrap_or_default()` — supply a fallback.",
        "- `map`, `and_then`, `filter`, `or` — transform without unwrapping. `map` applies a function to the inside; `and_then` is `map` for a function that itself returns an `Option` (it avoids `Option<Option<T>>`).",
        "- `ok_or(err)` — turn it into a `Result`.",
        "- `expect(\"message\")` — panic with your message if `None`. Acceptable when `None` really is a bug.",
        "- `unwrap()` — panic with a generic message. Fine in examples and tests; a smell in library code.",
        "",
        "## Where Options come from",
        "",
        "Anything that might not find something: `.get(i)` on a slice, `.first()`, `.last()`, `.next()` on an iterator, `HashMap::get`, `.find()`, `.checked_add()`, `.chars().next()`.",
        "",
        "> `?` works on `Option` too — in a function returning `Option`, `let x = maybe()?;` returns `None` early. Module 5 covers `?` properly.",
      ),
      code: `fn main() {
    let numbers = vec![10, 20, 30];

    // Option appears wherever a value might not be there.
    println!("get(1)  {:?}", numbers.get(1));
    println!("get(99) {:?}", numbers.get(99));

    // Explicit handling.
    match numbers.get(1) {
        Some(n) => println!("found {n}"),
        None => println!("nothing at index 1"),
    }

    // if let, when you only care about one case.
    if let Some(first) = numbers.first() {
        println!("first is {first}");
    }

    // Fallbacks.
    let missing: Option<i32> = None;
    println!("unwrap_or         {}", missing.unwrap_or(-1));
    println!("unwrap_or_else    {}", missing.unwrap_or_else(|| numbers.len() as i32));
    println!("unwrap_or_default {}", missing.unwrap_or_default());

    // Transforming without unwrapping.
    let maybe_name: Option<&str> = Some("ada");
    println!("map        {:?}", maybe_name.map(|n| n.to_uppercase()));
    println!("map on None{:?}", None::<&str>.map(|n: &str| n.to_uppercase()));
    println!("filter     {:?}", Some(4).filter(|n| n % 2 == 0));
    println!("filter out {:?}", Some(5).filter(|n| n % 2 == 0));

    // and_then chains operations that each might fail.
    println!("chained ok  {:?}", half_of_even(8));
    println!("chained bad {:?}", half_of_even(7));

    // Inspecting without consuming.
    println!("is_some {} is_none {}", maybe_name.is_some(), maybe_name.is_none());

    // Collecting only the values that exist.
    let inputs = ["1", "two", "3", "four"];
    let parsed: Vec<i32> = inputs.iter().filter_map(|s| s.parse().ok()).collect();
    println!("parsed {parsed:?}");

    // Option<&T> to Option<T> when T is Copy.
    let copied: Option<i32> = numbers.first().copied();
    println!("copied {copied:?}");

    // ? works in a function returning Option.
    println!("initials {:?}", initials("ada lovelace"));
    println!("initials {:?}", initials(""));

    // Turning absence into an error.
    let as_result: Result<&i32, &str> = numbers.get(9).ok_or("index out of range");
    println!("{as_result:?}");

    // expect documents the assumption; it panics if violated.
    println!("expect {}", numbers.first().expect("numbers is never empty"));
}

/// and_then avoids nesting Option inside Option.
fn half_of_even(n: i32) -> Option<i32> {
    Some(n).filter(|n| n % 2 == 0).and_then(|n| Some(n / 2))
}

/// The ? operator short-circuits to None.
fn initials(name: &str) -> Option<String> {
    let mut words = name.split_whitespace();
    let first = words.next()?.chars().next()?;
    let last = words.next()?.chars().next()?;
    Some(format!("{}{}", first.to_ascii_uppercase(), last.to_ascii_uppercase()))
}`,
      exercise: {
        prompt:
          "Given `let v: Vec<i32> = vec![];`, print the first element or `0` if the vector is empty — without using `unwrap()` or `match` — so the output contains `first: 0`.",
        expect: { contains: ["first: 0"] },
        hint: "`println!(\"first: {}\", v.first().copied().unwrap_or(0));`",
      },
    },

    {
      slug: "patterns",
      title: "Patterns in depth",
      summary:
        "Destructuring everywhere: bindings, guards, `@`, nested patterns, refutability.",
      tags: ["patterns", "destructuring", "@", "ref"],
      body: md(
        "Patterns are not a `match`-only feature. The same syntax appears in `let`, function parameters, `for` loops, closure arguments, `if let` and `while let`. Learning it once pays off everywhere.",
        "",
        "## Refutable vs irrefutable",
        "",
        "- An **irrefutable** pattern always matches: `let (a, b) = pair;`. These are what `let` and function parameters require.",
        "- A **refutable** pattern might not match: `Some(x)`. These need a construct that can cope with failure — `match`, `if let`, `while let`, `let ... else`.",
        "",
        "That is the whole reason `let Some(x) = opt;` is an error while `if let Some(x) = opt` is fine.",
        "",
        "## The toolkit",
        "",
        "| Pattern | Does |",
        "|---|---|",
        "| `_` | matches anything, binds nothing |",
        "| `_name` | binds, but silences the unused warning |",
        "| `..` | ignores the remaining fields or elements |",
        "| `a \\| b` | either alternative |",
        "| `1..=5` | an inclusive range |",
        "| `n @ 1..=5` | binds *and* tests |",
        "| `Point { x, .. }` | pulls out one field |",
        "| `[first, .., last]` | slice pattern |",
        "| `Some(Some(x))` | nests arbitrarily deep |",
        "| `ref x` / `ref mut x` | binds by reference (rarely needed now) |",
        "",
        "Modern Rust applies **match ergonomics**: matching a reference against a non-reference pattern automatically binds by reference, so `match &opt { Some(x) => ... }` gives you an `&T` without writing `ref`.",
        "",
        "Guards (`if cond` after a pattern) can use variables from outside the match, which ordinary patterns cannot — a pattern of `n` always *binds* rather than comparing.",
      ),
      code: `#[derive(Debug)]
struct Point {
    x: i32,
    y: i32,
}

#[derive(Debug)]
enum Shape {
    Circle { centre: Point, r: f64 },
    Rect { tl: Point, br: Point },
}

fn main() {
    // Irrefutable patterns in let and in parameters.
    let (a, b, c) = (1, 2, 3);
    println!("{a}{b}{c}");
    print_coords(&(7, 9));

    // Destructuring a struct, with and without renaming.
    let p = Point { x: 3, y: -4 };
    let Point { x, y } = &p;
    println!("x={x} y={y}");
    let Point { x: horizontal, .. } = &p;
    println!("just x: {horizontal}");

    // Nested destructuring inside a match.
    let shapes = vec![
        Shape::Circle { centre: Point { x: 0, y: 0 }, r: 2.0 },
        Shape::Rect { tl: Point { x: 0, y: 5 }, br: Point { x: 4, y: 0 } },
    ];
    for shape in &shapes {
        match shape {
            Shape::Circle { centre: Point { x: 0, y: 0 }, r } => {
                println!("circle at the origin, r={r}");
            }
            Shape::Circle { centre, r } => println!("circle at {centre:?}, r={r}"),
            Shape::Rect { tl, br } => {
                println!("rect {}x{}", (br.x - tl.x).abs(), (tl.y - br.y).abs());
            }
        }
    }

    // @ binds and tests at the same time.
    for n in [3, 7, 50] {
        match n {
            small @ 1..=5 => println!("{small} is small"),
            mid @ 6..=9 => println!("{mid} is middling"),
            other => println!("{other} is large"),
        }
    }

    // Guards can reference outside variables; patterns cannot.
    let threshold = 10;
    for n in [4, 10, 20] {
        match n {
            x if x < threshold => println!("{x} < {threshold}"),
            x if x == threshold => println!("{x} is exactly the threshold"),
            x => println!("{x} > {threshold}"),
        }
    }

    // Alternatives and ignoring.
    for ch in ['a', 'e', 'q', '7'] {
        let kind = match ch {
            'a' | 'e' | 'i' | 'o' | 'u' => "vowel",
            'a'..='z' => "consonant",
            '0'..='9' => "digit",
            _ => "other",
        };
        println!("{ch} is a {kind}");
    }

    // Slice patterns, including a bound rest.
    let data = [1, 2, 3, 4, 5];
    match &data[..] {
        [first, rest @ ..] => println!("first {first}, rest {rest:?}"),
        [] => println!("empty"),
    }

    // Nested Options.
    let nested: Option<Option<i32>> = Some(Some(5));
    match nested {
        Some(Some(n)) if n > 3 => println!("big inner value {n}"),
        Some(Some(n)) => println!("inner value {n}"),
        Some(None) => println!("outer some, inner none"),
        None => println!("nothing at all"),
    }

    // Patterns in a closure argument and in a for loop.
    let pairs = vec![(1, 'a'), (2, 'b')];
    pairs.iter().for_each(|(n, ch)| println!("{n}{ch}"));
    for (i, (n, ch)) in pairs.iter().enumerate() {
        println!("{i}: {n}{ch}");
    }

    // Match ergonomics: matching on a reference still gives usable bindings.
    let maybe_name = Some(String::from("ada"));
    match &maybe_name {
        Some(name) => println!("name has {} chars", name.len()),
        None => println!("no name"),
    }
    println!("still owned: {maybe_name:?}");
}

/// A pattern works as a function parameter too.
fn print_coords(&(x, y): &(i32, i32)) {
    println!("coords ({x}, {y})");
}`,
      exercise: {
        prompt:
          "Match on the tuple `(\"circle\", 2.0)` and print `shape: circle r=2` using a single `match` arm that destructures the tuple and binds both parts.",
        expect: { contains: ["shape: circle r=2"] },
        hint: "`match t { (name, r) => println!(\"shape: {name} r={r}\") }`",
      },
    },

    {
      slug: "if-let-and-let-else",
      title: "if let, while let and let-else",
      summary:
        "The lightweight alternatives to a full `match`, including the early-return idiom.",
      tags: ["if let", "while let", "let else", "matches!"],
      body: md(
        "A full `match` is overkill when you only care about one case. Rust has three shorthands.",
        "",
        "## `if let`",
        "",
        "```rust",
        "if let Some(n) = maybe {",
        "    println!(\"{n}\");",
        "} else {",
        "    println!(\"nothing\");",
        "}",
        "```",
        "",
        "The `else` is optional. Since Rust 1.65 you can also chain it with `else if let`. The cost of using it is that you give up the exhaustiveness check — so prefer `match` when the other cases actually need handling.",
        "",
        "## `while let`",
        "",
        "Loops as long as the pattern keeps matching. The canonical use is draining a collection:",
        "",
        "```rust",
        "while let Some(top) = stack.pop() { ... }",
        "```",
        "",
        "## `let ... else`",
        "",
        "The newest of the three, and the one that most improves real code. It binds in the *enclosing* scope and requires the `else` block to diverge (`return`, `break`, `continue` or `panic!`):",
        "",
        "```rust",
        "let Some(config) = load() else {",
        "    return Err(\"no config\".into());",
        "};",
        "// config is in scope here, unwrapped, at the original indentation",
        "```",
        "",
        "This is what replaces the \"pyramid of doom\" of nested `if let`s: handle each failure up front and leave the happy path flat.",
        "",
        "## `matches!`",
        "",
        "When all you want is a `bool`, `matches!(value, Pattern)` is a one-liner that supports guards too.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

#[derive(Debug)]
enum Event {
    Click { x: i32, y: i32 },
    Key(char),
    Scroll(i32),
    Close,
}

fn main() {
    let maybe: Option<i32> = Some(7);

    // if let, with an else.
    if let Some(n) = maybe {
        println!("got {n}");
    } else {
        println!("got nothing");
    }

    // Chained: else if let.
    let config: Option<&str> = None;
    let fallback: Option<&str> = Some("default.toml");
    if let Some(path) = config {
        println!("using {path}");
    } else if let Some(path) = fallback {
        println!("falling back to {path}");
    } else {
        println!("no configuration at all");
    }

    // while let: drain a stack.
    let mut stack = vec![1, 2, 3, 4];
    while let Some(top) = stack.pop() {
        print!("{top} ");
    }
    println!("-> stack is {stack:?}");

    // while let on an iterator.
    let mut chars = "rust".chars();
    while let Some(ch) = chars.next() {
        print!("[{ch}]");
    }
    println!();

    // let-else: validate early, keep the happy path flat.
    for raw in ["42", "oops", "100"] {
        match double_it(raw) {
            Ok(n) => println!("{raw} doubled is {n}"),
            Err(e) => println!("{raw} rejected: {e}"),
        }
    }

    // matches! for a quick boolean test.
    let events = vec![
        Event::Click { x: 3, y: 4 },
        Event::Key('q'),
        Event::Scroll(-2),
        Event::Close,
    ];
    println!("any close event? {}", events.iter().any(|e| matches!(e, Event::Close)));
    println!(
        "keys pressed: {}",
        events.iter().filter(|e| matches!(e, Event::Key(_))).count()
    );
    println!(
        "big scrolls: {}",
        events.iter().filter(|e| matches!(e, Event::Scroll(n) if n.abs() > 1)).count()
    );

    // if let on a struct-like variant.
    for e in &events {
        if let Event::Click { x, y } = e {
            println!("clicked at ({x}, {y})");
        }
    }
}

/// let-else shines here: two failure cases, no nesting, no unwrap.
fn double_it(raw: &str) -> Result<i32, String> {
    let Ok(n) = raw.parse::<i32>() else {
        return Err(format!("{raw:?} is not a number"));
    };
    let Some(doubled) = n.checked_mul(2) else {
        return Err("overflowed".to_string());
    };
    Ok(doubled)
}`,
      exercise: {
        prompt:
          "Use `while let` with `pop()` to sum `vec![5, 10, 15]` by draining it, and print `drained: 30`.",
        expect: { contains: ["drained: 30"], sourceContains: ["while let"] },
        hint: "`let mut total = 0; while let Some(n) = v.pop() { total += n; }`",
      },
    },
  ],
};
