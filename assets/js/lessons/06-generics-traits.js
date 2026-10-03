import { md } from "./_util.js";

export default {
  id: "generics-traits",
  n: 6,
  title: "Generics, traits & lifetimes",
  summary:
    "Writing code once for many types, defining shared behaviour, and naming the lifetimes the compiler cannot infer.",
  lessons: [
    {
      slug: "generics",
      title: "Generics",
      summary:
        "Type parameters, and why they cost nothing at runtime.",
      tags: ["<T>", "monomorphisation", "turbofish"],
      body: md(
        "A generic function is written once and compiled for each concrete type it is used with:",
        "",
        "```rust",
        "fn largest<T: PartialOrd>(items: &[T]) -> &T { ... }",
        "```",
        "",
        "`T` is a type parameter. The `: PartialOrd` is a **bound**: it tells the compiler what `T` must be capable of, which is what lets the body use `>`. Without a bound, `T` could be anything, so almost nothing would be legal inside.",
        "",
        "This is a real difference from dynamically typed generics: the body is type-checked *once*, against the bounds, before it is ever instantiated. If it compiles, it compiles for every `T` that satisfies the bounds.",
        "",
        "## Monomorphisation",
        "",
        "At compile time Rust generates a separate specialised copy of the function for each type used — `largest::<i32>`, `largest::<char>` — and calls are direct, inlinable, and exactly as fast as hand-written versions. Generics are a **zero-cost abstraction**: no boxing, no vtable, no runtime type lookup.",
        "",
        "The cost shows up elsewhere: bigger binaries and longer compile times.",
        "",
        "## Where generics appear",
        "",
        "- functions: `fn f<T>(x: T)`",
        "- structs: `struct Pair<T> { a: T, b: T }`",
        "- enums: `Option<T>`, `Result<T, E>` — you have been using generics all along",
        "- impl blocks: `impl<T> Pair<T>`, and you can add methods only for *some* `T` with a narrower `impl<T: Display> Pair<T>`",
        "",
        "## `where` clauses and the turbofish",
        "",
        "Several bounds read better moved to a `where` clause. And when a call site is ambiguous, name the type explicitly with the **turbofish**: `\"42\".parse::<i32>()`, `v.iter().sum::<i32>()`, `collect::<Vec<_>>()`.",
      ),
      code: `use std::fmt::Display;

/// One type parameter with one bound.
fn largest<T: PartialOrd>(items: &[T]) -> &T {
    let mut biggest = &items[0];
    for item in items {
        if item > biggest {
            biggest = item;
        }
    }
    biggest
}

/// Several bounds read better in a where clause.
fn describe_all<T>(items: &[T]) -> String
where
    T: Display + Clone,
{
    items.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(", ")
}

/// Two independent type parameters.
fn pair_up<A, B>(a: A, b: B) -> (A, B) {
    (a, b)
}

/// A generic struct.
#[derive(Debug)]
struct Pair<T> {
    first: T,
    second: T,
}

impl<T> Pair<T> {
    fn new(first: T, second: T) -> Self {
        Self { first, second }
    }

    fn swap(self) -> Self {
        Self { first: self.second, second: self.first }
    }
}

/// Methods available only when T can be compared and shown.
impl<T: PartialOrd + Display> Pair<T> {
    fn announce_larger(&self) {
        if self.first >= self.second {
            println!("    the larger is {}", self.first);
        } else {
            println!("    the larger is {}", self.second);
        }
    }
}

/// Two parameters, and a method that mixes types from another Pair.
#[derive(Debug)]
struct Mixed<A, B> {
    left: A,
    right: B,
}

impl<A, B> Mixed<A, B> {
    fn flip(self) -> Mixed<B, A> {
        Mixed { left: self.right, right: self.left }
    }
}

fn main() {
    // One function, several types.
    println!("largest number: {}", largest(&[34, 50, 25, 100, 65]));
    println!("largest char:   {}", largest(&['y', 'm', 'a', 'q']));
    println!("largest float:  {}", largest(&[1.5, 9.25, 3.0]));
    println!("largest word:   {}", largest(&["pear", "fig", "banana"]));

    println!("{}", describe_all(&[1, 2, 3]));
    println!("{}", describe_all(&["a", "b"]));

    println!("{:?}", pair_up("age", 31));
    println!("{:?}", pair_up(1.5, true));

    let p = Pair::new(5, 10);
    println!("{p:?}");
    p.announce_larger();
    println!("swapped {:?}", Pair::new(5, 10).swap());

    // Bounds are checked per impl: this Pair has no announce_larger,
    // because Vec<i32> is not PartialOrd + Display.
    let vectors = Pair::new(vec![1], vec![2]);
    println!("{vectors:?}");
    // vectors.announce_larger(); // <-- uncomment: bound not satisfied

    let m = Mixed { left: 1, right: "one" };
    println!("{m:?}");
    println!("flipped {:?}", m.flip()); // flip takes self, so m is moved here

    // The turbofish disambiguates when inference cannot.
    let total = (1..=10).sum::<i32>();
    let collected = (1..4).collect::<Vec<u8>>();
    let parsed = "2.5".parse::<f64>().unwrap();
    println!("{total} {collected:?} {parsed}");

    // Generic code is monomorphised: these are two distinct compiled functions.
    println!("{} {}", identity(7), identity("seven"));
}

fn identity<T>(x: T) -> T {
    x
}`,
      exercise: {
        prompt:
          "Write a generic `fn first_or<T: Copy>(items: &[T], fallback: T) -> T` that returns the first element or the fallback, and print `got: 9` by calling it with an empty `&[i32]` slice and `9`.",
        expect: { contains: ["got: 9"] },
        hint: "`items.first().copied().unwrap_or(fallback)` — and call it as `first_or(&[] as &[i32], 9)`.",
      },
    },

    {
      slug: "traits",
      title: "Traits",
      summary:
        "Defining shared behaviour, default methods, and the rule that keeps implementations unambiguous.",
      tags: ["trait", "impl Trait for", "default methods"],
      body: md(
        "A trait is a set of method signatures that a type can promise to provide. If you know interfaces or typeclasses, you are most of the way there.",
        "",
        "```rust",
        "trait Summary {",
        "    fn author(&self) -> String;                 // required",
        "",
        "    fn summarise(&self) -> String {             // default",
        "        format!(\"(read more from {}...)\", self.author())",
        "    }",
        "}",
        "",
        "impl Summary for Article {",
        "    fn author(&self) -> String { self.by.clone() }",
        "}",
        "```",
        "",
        "## Default methods",
        "",
        "A trait method with a body is a default. Implementors get it for free and may override it. Defaults can call required methods — which is how a trait with one required method can offer a dozen conveniences. That is exactly how `Iterator` works: implement `next`, receive seventy-odd adapters.",
        "",
        "## The orphan rule",
        "",
        "You may implement a trait for a type only if **you own the trait or you own the type**. You cannot implement someone else's trait for someone else's type — e.g. `Display` for `Vec<T>`, both from std.",
        "",
        "Without this rule, two crates could define conflicting impls and linking them together would be impossible. When you do need it, wrap the foreign type in a newtype (`struct MyVec(Vec<T>)`) and implement on that.",
        "",
        "## Traits you will meet constantly",
        "",
        "`Debug` `Display` `Clone` `Copy` `PartialEq` `Eq` `PartialOrd` `Ord` `Hash` `Default` `From` `Into` `TryFrom` `Iterator` `IntoIterator` `Drop` `Deref` `Add` `Error` `Send` `Sync`.",
        "",
        "Many are derivable. Implementing `From<A> for B` is particularly high-value: it gives you `Into` for free, plus the automatic conversion `?` uses.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

use std::fmt;

trait Summary {
    /// Required: every implementor must supply this.
    fn author(&self) -> String;

    /// Required.
    fn headline(&self) -> String;

    /// Default: built out of the required methods, overridable.
    fn summarise(&self) -> String {
        format!("{} — by {}", self.headline(), self.author())
    }

    /// Defaults can call other defaults.
    fn preview(&self) -> String {
        let s = self.summarise();
        if s.len() > 40 {
            format!("{}...", &s[..37])
        } else {
            s
        }
    }
}

struct Article {
    title: String,
    by: String,
    body: String,
}

struct Tweet {
    handle: String,
    text: String,
}

impl Summary for Article {
    fn author(&self) -> String {
        self.by.clone()
    }
    fn headline(&self) -> String {
        self.title.clone()
    }
}

impl Summary for Tweet {
    fn author(&self) -> String {
        format!("@{}", self.handle)
    }
    fn headline(&self) -> String {
        self.text.clone()
    }
    /// Overriding the default.
    fn summarise(&self) -> String {
        format!("{}: {}", self.author(), self.text)
    }
}

/// Implementing Display gives you {}, .to_string() and more.
impl fmt::Display for Article {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{} ({} words)", self.title, self.body.split_whitespace().count())
    }
}

/// Default gives you Type::default() and ..Default::default() in struct updates.
#[derive(Debug)]
struct Settings {
    verbose: bool,
    retries: u32,
    name: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self { verbose: false, retries: 3, name: "unnamed".to_string() }
    }
}

/// From gives you Into for free, and powers ? conversions.
struct Celsius(f64);
struct Fahrenheit(f64);

impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self {
        Fahrenheit(c.0 * 9.0 / 5.0 + 32.0)
    }
}

/// The orphan rule in action: we cannot impl Display for Vec<i32>, so we wrap it.
struct Row(Vec<i32>);

impl fmt::Display for Row {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let cells: Vec<String> = self.0.iter().map(|n| format!("{n:>4}")).collect();
        write!(f, "|{}|", cells.join("|"))
    }
}

fn main() {
    let article = Article {
        title: "Ownership explained".to_string(),
        by: "ada".to_string(),
        body: "a b c d e".to_string(),
    };
    let tweet = Tweet {
        handle: "rustlang".to_string(),
        text: "1.0 is out".to_string(),
    };

    println!("{}", article.summarise());
    println!("{}", tweet.summarise()); // the override
    println!("{}", article.preview());

    // Display gives us {} and to_string().
    println!("display: {article}");
    println!("as string: {}", article.to_string());

    // Default.
    println!("{:?}", Settings::default());
    let custom = Settings { verbose: true, ..Default::default() };
    println!("{custom:?}");

    // From, and the Into it hands you for free.
    let f: Fahrenheit = Celsius(100.0).into();
    println!("100C = {}F", f.0);
    println!("0C = {}F", Fahrenheit::from(Celsius(0.0)).0);

    // The newtype wrapper, so we can Display something from std.
    println!("{}", Row(vec![1, 22, 333]));
}`,
      exercise: {
        prompt:
          "Define `trait Greet { fn name(&self) -> String; fn hello(&self) -> String { format!(\"hello, {}\", self.name()) } }`, implement it for a struct holding a name, and print `hello, ada` using the **default** method.",
        expect: { contains: ["hello, ada"] },
        hint: "Only implement `name()`; do not override `hello()`. Then call `thing.hello()`.",
      },
    },

    {
      slug: "trait-bounds",
      title: "Trait bounds and impl Trait",
      summary:
        "Three ways to say 'any type that can do this', and which to reach for.",
      tags: ["impl Trait", "where", "bounds", "generic"],
      body: md(
        "Four spellings, two of them identical in meaning:",
        "",
        "```rust",
        "fn a(item: &impl Summary) {}                 // argument position impl Trait",
        "fn b<T: Summary>(item: &T) {}                // the same thing, desugared",
        "fn c<T>(item: &T) where T: Summary {}        // also the same",
        "fn d() -> impl Summary { ... }               // return position: different!",
        "```",
        "",
        "`a`, `b` and `c` are interchangeable. Prefer `impl Trait` for a single simple bound, and a `where` clause once there are several or they get long.",
        "",
        "The genuine difference: `<T: Summary>` lets the **caller** choose `T`, and lets you name it — needed if two parameters must be the *same* type:",
        "",
        "```rust",
        "fn pair<T: Summary>(a: &T, b: &T)        // both the same type",
        "fn pair(a: &impl Summary, b: &impl Summary)  // may be different types",
        "```",
        "",
        "## Return position impl Trait",
        "",
        "`-> impl Iterator<Item = u32>` means \"I return some concrete type that iterates `u32`, and I am not telling you which\". This is how you return a closure or an iterator chain whose real type is an unpronounceable nest of adapters. It stays statically dispatched, so it costs nothing.",
        "",
        "The constraint: **one** concrete type. Returning a different type from each branch does not compile — that needs `Box<dyn Trait>`, the next lesson.",
        "",
        "## Conditional impls",
        "",
        "`impl<T: Display> Pair<T>` adds methods only when the bound holds. The standard library uses this heavily — e.g. `ToString` is blanket-implemented for every `T: Display`, which is why implementing `Display` silently gives you `.to_string()`.",
      ),
      code: `use std::fmt::{Debug, Display};

trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> &'static str;
}

#[derive(Debug, Clone)]
struct Circle {
    r: f64,
}
#[derive(Debug, Clone)]
struct Square {
    side: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.r * self.r
    }
    fn name(&self) -> &'static str {
        "circle"
    }
}

impl Shape for Square {
    fn area(&self) -> f64 {
        self.side * self.side
    }
    fn name(&self) -> &'static str {
        "square"
    }
}

/// Argument-position impl Trait: concise, caller picks the type.
fn report(shape: &impl Shape) {
    println!("{} has area {:.2}", shape.name(), shape.area());
}

/// The desugared form. Identical in effect.
fn report_generic<S: Shape>(shape: &S) {
    println!("{} has area {:.2}", shape.name(), shape.area());
}

/// A where clause, once the bounds grow.
fn log_both<S>(a: &S, b: &S) -> f64
where
    S: Shape + Debug + Clone,
{
    println!("comparing {a:?} and {b:?}");
    a.area() + b.area()
}

/// Naming the parameter forces both arguments to be the SAME type.
fn total_of_same<S: Shape>(shapes: &[S]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

/// Return position impl Trait: hides an unnameable iterator type.
fn evens_up_to(n: u32) -> impl Iterator<Item = u32> {
    (0..=n).filter(|x| x % 2 == 0)
}

/// Returning a closure, whose type has no name at all.
fn multiplier(factor: i32) -> impl Fn(i32) -> i32 {
    move |x| x * factor
}

/// Multiple bounds, and a generic return.
fn largest_named<T: PartialOrd + Display>(items: &[T]) -> String {
    let mut best = &items[0];
    for item in items {
        if item > best {
            best = item;
        }
    }
    format!("largest is {best}")
}

/// Blanket impls: anything Display gets this method.
trait Shout {
    fn shout(&self) -> String;
}

impl<T: Display> Shout for T {
    fn shout(&self) -> String {
        format!("{}!!", self.to_string().to_uppercase())
    }
}

fn main() {
    let c = Circle { r: 1.0 };
    let s = Square { side: 2.0 };

    report(&c);
    report_generic(&s);

    println!("combined area {:.2}", log_both(&c, &c.clone()));
    // log_both(&c, &s); // <-- uncomment: both must be the same type

    println!("squares total {:.2}", total_of_same(&[s.clone(), Square { side: 3.0 }]));

    // An iterator returned by impl Trait behaves like any other.
    println!("evens: {:?}", evens_up_to(10).collect::<Vec<u32>>());
    println!("sum:   {}", evens_up_to(100).sum::<u32>());

    // A returned closure.
    let triple = multiplier(3);
    println!("triple(7) = {}", triple(7));

    println!("{}", largest_named(&[3, 9, 4]));
    println!("{}", largest_named(&["kiwi", "apple"]));

    // The blanket impl applies to everything printable.
    println!("{}", "hello".shout());
    println!("{}", 42.shout());
    println!("{}", 1.5.shout());
}`,
      exercise: {
        prompt:
          "Write `fn describe(x: &impl std::fmt::Debug) -> String` returning `format!(\"{x:?}\")`, and call it with `vec![1, 2]` so the output contains `[1, 2]`.",
        expect: { contains: ["[1, 2]"], sourceContains: ["impl"] },
        hint: "`fn describe(x: &impl Debug) -> String { format!(\"{x:?}\") }` then `println!(\"{}\", describe(&vec![1, 2]));`",
      },
    },

    {
      slug: "trait-objects",
      title: "Trait objects & dynamic dispatch",
      summary:
        "Collections of different types behind one trait, and what it costs.",
      tags: ["dyn", "Box<dyn Trait>", "vtable", "object safety"],
      body: md(
        "Generics give you one concrete type per instantiation. Sometimes you need a `Vec` holding a `Circle`, a `Square` and a `Triangle` *at the same time* — and a `Vec<T>` cannot do that, because every element must be the same `T`.",
        "",
        "The answer is a **trait object**: `&dyn Shape` or `Box<dyn Shape>`.",
        "",
        "```rust",
        "let shapes: Vec<Box<dyn Shape>> = vec![",
        "    Box::new(Circle { r: 1.0 }),",
        "    Box::new(Square { side: 2.0 }),",
        "];",
        "for s in &shapes { println!(\"{}\", s.area()); }",
        "```",
        "",
        "## How it works, and what it costs",
        "",
        "A `dyn Trait` reference is a **fat pointer**: one word to the data, one to a vtable of that type's method implementations. Calls go through the vtable, so:",
        "",
        "| | generics (`impl Trait`) | trait objects (`dyn Trait`) |",
        "|---|---|---|",
        "| Dispatch | static, at compile time | dynamic, at runtime |",
        "| Inlining | yes | essentially no |",
        "| Code size | one copy per type | one copy total |",
        "| Mixed types in one collection | no | yes |",
        "",
        "The runtime cost is one indirect call — small, but it blocks inlining, which can matter in a hot loop. Reach for generics by default and trait objects when you need the flexibility.",
        "",
        "## Object safety",
        "",
        "Not every trait can be a `dyn Trait`. The compiler must be able to build a vtable, so the trait may not have generic methods, nor methods returning `Self` by value, nor `Sized` on `Self`. That is why `Clone` is not object safe: `fn clone(&self) -> Self` has no fixed size to return into.",
        "",
        "> `dyn` has been mandatory since the 2018 edition. Bare `Box<Shape>` in older material means `Box<dyn Shape>`.",
      ),
      code: `use std::fmt::Debug;

trait Draw {
    fn draw(&self) -> String;
    /// A default method works on trait objects too.
    fn describe(&self) -> String {
        format!("<{}>", self.draw())
    }
}

#[derive(Debug)]
struct Button {
    label: String,
}
#[derive(Debug)]
struct Checkbox {
    checked: bool,
}
#[derive(Debug)]
struct Slider {
    value: u8,
}

impl Draw for Button {
    fn draw(&self) -> String {
        format!("[ {} ]", self.label)
    }
}

impl Draw for Checkbox {
    fn draw(&self) -> String {
        format!("[{}]", if self.checked { "x" } else { " " })
    }
}

impl Draw for Slider {
    fn draw(&self) -> String {
        let filled = (self.value as usize) / 10;
        format!("{}{}", "=".repeat(filled), "-".repeat(10 - filled))
    }
}

/// A heterogeneous collection — impossible with a plain generic Vec<T>.
struct Screen {
    widgets: Vec<Box<dyn Draw>>,
}

impl Screen {
    fn render(&self) {
        for w in &self.widgets {
            println!("  {}", w.describe());
        }
    }
}

/// Borrowed trait objects, when you do not need ownership.
fn render_all(items: &[&dyn Draw]) {
    for item in items {
        println!("  {}", item.draw());
    }
}

/// Returning different concrete types from one function needs a trait object.
fn pick(kind: &str) -> Box<dyn Draw> {
    match kind {
        "button" => Box::new(Button { label: "ok".to_string() }),
        "check" => Box::new(Checkbox { checked: true }),
        _ => Box::new(Slider { value: 70 }),
    }
}

/// Trait objects can require several traits, as long as the extras are markers.
fn debug_draw(item: &dyn DrawDebug) {
    println!("  {} :: {:?}", item.draw(), item);
}
trait DrawDebug: Draw + Debug {}
impl<T: Draw + Debug> DrawDebug for T {}

fn main() {
    let screen = Screen {
        widgets: vec![
            Box::new(Button { label: "save".to_string() }),
            Box::new(Checkbox { checked: false }),
            Box::new(Slider { value: 40 }),
        ],
    };
    println!("owned trait objects:");
    screen.render();

    println!("borrowed trait objects:");
    let b = Button { label: "cancel".to_string() };
    let c = Checkbox { checked: true };
    render_all(&[&b, &c]);

    println!("chosen at runtime:");
    for kind in ["button", "check", "slider"] {
        println!("  {} -> {}", kind, pick(kind).draw());
    }

    println!("with a supertrait bound:");
    debug_draw(&b);
    debug_draw(&Slider { value: 100 });

    // A fat pointer is two words: data plus vtable.
    println!(
        "&Button is {} bytes, &dyn Draw is {} bytes",
        size_of::<&Button>(),
        size_of::<&dyn Draw>()
    );

    // Trait objects can be stored, filtered and counted like anything else.
    let all: Vec<Box<dyn Draw>> = vec![pick("button"), pick("check"), pick("slider")];
    let wide = all.iter().filter(|w| w.draw().len() > 5).count();
    println!("{} of {} widgets render wider than 5 chars", wide, all.len());
}`,
      exercise: {
        prompt:
          "Build a `Vec<Box<dyn std::fmt::Display>>` containing the number `1`, the string `\"two\"` and the float `3.5`, then print each on its own line. The output should contain `two`.",
        expect: { contains: ["two"], sourceContains: ["dyn"] },
        hint: "`let items: Vec<Box<dyn Display>> = vec![Box::new(1), Box::new(\"two\"), Box::new(3.5)]; for i in &items { println!(\"{i}\"); }`",
      },
    },

    {
      slug: "operator-overloading",
      title: "Operator overloading & conversions",
      summary:
        "Add, Index, PartialOrd, Display, From — making your types feel built in.",
      tags: ["Add", "Index", "Ord", "From", "Iterator"],
      body: md(
        "Rust's operators are trait methods. Implement the trait and the operator works on your type — there is no separate operator-overloading feature.",
        "",
        "| Operator | Trait | Method |",
        "|---|---|---|",
        "| `a + b` | `Add` | `add` |",
        "| `a - b` `a * b` `a / b` `a % b` | `Sub` `Mul` `Div` `Rem` | |",
        "| `-a` `!a` | `Neg` `Not` | |",
        "| `a += b` | `AddAssign` | `add_assign` |",
        "| `a[i]` | `Index` / `IndexMut` | `index` |",
        "| `a == b` | `PartialEq` | `eq` |",
        "| `a < b` | `PartialOrd` | `partial_cmp` |",
        "| `*a` | `Deref` | `deref` |",
        "| `a()` | `Fn` family | |",
        "",
        "`Add` has an associated type `Output`, so `Point + Point` may produce something other than a `Point`, and a generic parameter `Rhs` defaulting to `Self`, so you can also define `Point * f64`.",
        "",
        "## Ordering",
        "",
        "`PartialOrd` gives the comparison operators. `Ord` additionally promises a *total* order — every pair is comparable — which is what `sort()`, `BTreeMap` and `max()` require. Floats are only `PartialOrd`, because `NaN` is unordered.",
        "",
        "Derive them when field-by-field lexicographic order is what you want; implement `Ord` by hand to sort by a specific key.",
        "",
        "## Conversions",
        "",
        "`From` and `TryFrom` are the conventional entry points, and each gives you the matching `Into`/`TryInto` automatically. Implement `From`, never `Into`.",
        "",
        "> Keep operators meaning what people expect. Overloading `+` to mean \"send over the network\" is legal and deeply unkind.",
      ),
      code: `use std::cmp::Ordering;
use std::fmt;
use std::ops::{Add, AddAssign, Index, Mul, Neg};

#[derive(Debug, Clone, Copy, PartialEq)]
struct Vec2 {
    x: f64,
    y: f64,
}

impl Add for Vec2 {
    type Output = Vec2;
    fn add(self, other: Vec2) -> Vec2 {
        Vec2 { x: self.x + other.x, y: self.y + other.y }
    }
}

impl AddAssign for Vec2 {
    fn add_assign(&mut self, other: Vec2) {
        self.x += other.x;
        self.y += other.y;
    }
}

/// Rhs defaults to Self, but can be anything — here, a scalar.
impl Mul<f64> for Vec2 {
    type Output = Vec2;
    fn mul(self, k: f64) -> Vec2 {
        Vec2 { x: self.x * k, y: self.y * k }
    }
}

impl Neg for Vec2 {
    type Output = Vec2;
    fn neg(self) -> Vec2 {
        Vec2 { x: -self.x, y: -self.y }
    }
}

impl fmt::Display for Vec2 {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({:.1}, {:.1})", self.x, self.y)
    }
}

/// Index lets a type be subscripted.
struct Grid {
    cells: Vec<u8>,
    width: usize,
}

impl Index<(usize, usize)> for Grid {
    type Output = u8;
    fn index(&self, (row, col): (usize, usize)) -> &u8 {
        &self.cells[row * self.width + col]
    }
}

/// Custom ordering: sort by score descending, then name ascending.
#[derive(Debug, PartialEq, Eq)]
struct Player {
    name: String,
    score: u32,
}

impl Ord for Player {
    fn cmp(&self, other: &Self) -> Ordering {
        other.score.cmp(&self.score).then(self.name.cmp(&other.name))
    }
}

impl PartialOrd for Player {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// From, and the TryFrom that reports failure.
struct Rgb(u8, u8, u8);

impl From<(u8, u8, u8)> for Rgb {
    fn from(t: (u8, u8, u8)) -> Self {
        Rgb(t.0, t.1, t.2)
    }
}

impl TryFrom<&str> for Rgb {
    type Error = String;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        let hex = s.strip_prefix('#').ok_or("must start with #")?;
        if hex.len() != 6 {
            return Err(format!("expected 6 hex digits, got {}", hex.len()));
        }
        let parse = |i: usize| {
            u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| e.to_string())
        };
        Ok(Rgb(parse(0)?, parse(2)?, parse(4)?))
    }
}

impl fmt::Display for Rgb {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "#{:02x}{:02x}{:02x}", self.0, self.1, self.2)
    }
}

fn main() {
    let a = Vec2 { x: 1.0, y: 2.0 };
    let b = Vec2 { x: 0.5, y: -1.0 };

    println!("{a} + {b} = {}", a + b);
    println!("{a} * 3 = {}", a * 3.0);
    println!("-{a} = {}", -a);
    println!("equal? {}", a == Vec2 { x: 1.0, y: 2.0 });

    let mut acc = Vec2 { x: 0.0, y: 0.0 };
    for v in [a, b, a] {
        acc += v;
    }
    println!("accumulated {acc}");

    let grid = Grid { cells: (0u8..9).collect(), width: 3 };
    println!("grid[(1,2)] = {}", grid[(1, 2)]);

    let mut board = vec![
        Player { name: "cy".to_string(), score: 30 },
        Player { name: "ana".to_string(), score: 50 },
        Player { name: "bo".to_string(), score: 50 },
    ];
    board.sort();
    for (i, p) in board.iter().enumerate() {
        println!("{}. {} {}", i + 1, p.name, p.score);
    }
    println!("winner {:?}", board.iter().min());

    // From / Into.
    let c: Rgb = (255, 128, 0).into();
    println!("from tuple: {c}");

    // TryFrom / TryInto, which can fail.
    for input in ["#00ff7f", "ff7f00", "#abc"] {
        match Rgb::try_from(input) {
            Ok(c) => println!("{input} parsed as {c}"),
            Err(e) => println!("{input} rejected: {e}"),
        }
    }
}`,
      exercise: {
        prompt:
          "Implement `Add` for a tuple struct `Money(i64)` so that `Money(150) + Money(75)` works, and print the inner value so the output contains `total: 225`.",
        expect: { contains: ["total: 225"] },
        hint: "`impl Add for Money { type Output = Money; fn add(self, o: Money) -> Money { Money(self.0 + o.0) } }`",
      },
    },

    {
      slug: "lifetimes-explicit",
      title: "Writing lifetimes out",
      summary:
        "What `'a` means, the elision rules that usually hide it, and `'static`.",
      tags: ["'a", "elision", "'static", "structs"],
      body: md(
        "Every reference has a lifetime. Almost always it is inferred; occasionally the compiler needs you to state the relationship.",
        "",
        "```rust",
        "fn longest<'a>(a: &'a str, b: &'a str) -> &'a str",
        "```",
        "",
        "Read that as: *given some lifetime `'a` that both inputs live at least as long as, the output is valid for that same `'a`*. You are not changing how long anything lives — you are **describing** a constraint the compiler will then enforce at every call site.",
        "",
        "Without it, the signature is ambiguous: does the result borrow from `a` or from `b`? The compiler will not guess, so it asks.",
        "",
        "## The elision rules",
        "",
        "You can omit lifetimes when these suffice:",
        "",
        "1. Each elided input lifetime gets its own fresh parameter.",
        "2. If there is exactly **one** input lifetime, the output gets it. (`fn first_word(s: &str) -> &str` — no annotation needed.)",
        "3. If one input is `&self` or `&mut self`, the output gets `self`'s lifetime. This is why methods rarely need annotations.",
        "",
        "`longest` needs annotation because it has two input lifetimes and no `self`, so none of the rules apply.",
        "",
        "## Lifetimes on structs",
        "",
        "A struct holding a reference must declare the lifetime, and that struct then cannot outlive what it borrows:",
        "",
        "```rust",
        "struct Excerpt<'a> { part: &'a str }",
        "```",
        "",
        "This is the backbone of zero-copy parsing: tokens that point into the original input instead of allocating copies.",
        "",
        "## `'static`",
        "",
        "`&'static T` lives for the whole program. String literals are `&'static str` because they are baked into the binary. `T: 'static` as a *bound* is subtly different — it means the type contains no borrowed data with a shorter life, which is why spawned threads require it.",
      ),
      code: `/// Two input lifetimes and a borrowed return: annotation required.
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() { a } else { b }
}

/// Elision rule 2: one input, so the output lifetime is obvious.
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

/// Only one lifetime matters to the result, so say so and leave the other free.
fn prefix_of<'a>(text: &'a str, _separator: &str) -> &'a str {
    text.split(' ').next().unwrap_or(text)
}

/// A struct that borrows: it may not outlive the text it points into.
#[derive(Debug)]
struct Excerpt<'a> {
    part: &'a str,
}

impl<'a> Excerpt<'a> {
    fn new(source: &'a str) -> Self {
        let end = source.find('.').unwrap_or(source.len());
        Excerpt { part: &source[..end] }
    }

    /// Elision rule 3: &self, so the output borrows from self.
    fn announce(&self, note: &str) -> &str {
        println!("  attention: {note}");
        self.part
    }

    fn word_count(&self) -> usize {
        self.part.split_whitespace().count()
    }
}

/// Zero-copy tokenising: every token points into the original string.
#[derive(Debug)]
struct Token<'a> {
    kind: &'static str,
    text: &'a str,
}

fn tokenise<'a>(input: &'a str) -> Vec<Token<'a>> {
    input
        .split_whitespace()
        .map(|w| Token {
            kind: if w.chars().all(|c| c.is_ascii_digit()) {
                "number"
            } else {
                "word"
            },
            text: w,
        })
        .collect()
}

/// A 'static bound: the type may not hold short-lived borrows.
fn describe_owned<T: std::fmt::Debug + 'static>(value: T) {
    println!("  owns its data: {value:?}");
}

fn main() {
    let long = String::from("a longer piece of text");
    let short = "brief";
    println!("longest: {}", longest(&long, short));
    println!("first word: {}", first_word(&long));
    println!("prefix: {}", prefix_of(&long, ","));

    // The borrow must outlive the result. Uncomment to see it fail:
    // let result;
    // {
    //     let temporary = String::from("short lived");
    //     result = longest(&long, &temporary);
    // }
    // println!("{result}");

    let novel = String::from("Call me Ishmael. Some years ago...");
    let excerpt = Excerpt::new(&novel);
    println!("{excerpt:?} has {} words", excerpt.word_count());
    println!("announced: {}", excerpt.announce("first sentence only"));

    // Zero-copy tokens: no allocation per token, just borrowed slices.
    let source = "add 42 to 7";
    let tokens = tokenise(source);
    for t in &tokens {
        println!("  {:>6} {:?}", t.kind, t.text);
    }
    println!("{} tokens, all borrowed from one String", tokens.len());

    // 'static as a bound: owned data qualifies, a short borrow does not.
    describe_owned(String::from("owned"));
    describe_owned(42);
    let literal: &'static str = "baked into the binary";
    describe_owned(literal);
}`,
      exercise: {
        prompt:
          "Write `fn shorter<'a>(a: &'a str, b: &'a str) -> &'a str` returning whichever string is shorter, and print `shorter: fig` for the inputs `\"banana\"` and `\"fig\"`.",
        expect: { contains: ["shorter: fig"] },
        hint: "`if a.len() <= b.len() { a } else { b }` — the annotation is required because there are two input references.",
      },
    },
  ],
};
