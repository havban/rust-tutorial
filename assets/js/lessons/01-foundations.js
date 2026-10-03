import { md } from "./_util.js";

export default {
  id: "foundations",
  n: 1,
  title: "Foundations",
  summary:
    "Your first program, printing and formatting, bindings, mutability, the scalar types, and functions.",
  lessons: [
    {
      slug: "hello-world",
      title: "Hello, world!",
      summary: "The smallest complete Rust program, and what each piece is doing.",
      tags: ["fn main", "println!", "macros"],
      body: md(
        "Every Rust executable starts at a function called `main`. It takes no arguments and, usually, returns nothing.",
        "",
        "The line that does the printing is `println!`, and that exclamation mark matters: it marks a **macro**, not a function. Macros run at compile time and expand into real code. That is how `println!` is able to check your format string against the arguments you gave it *before* the program is ever built — a typo in a format string is a compile error, not a runtime surprise.",
        "",
        "## What happens when you press Run",
        "",
        "Locally you would do this with Cargo, Rust's build tool and package manager:",
        "",
        "```bash",
        "cargo new hello     # create a project",
        "cargo run           # compile and execute it",
        "```",
        "",
        "Rust is compiled ahead of time. There is no interpreter and no VM — `rustc` turns your source into a native binary, and that binary is what runs. The short pause you see below is a real compile.",
        "",
        "> Statements end in a semicolon. Blocks are wrapped in `{}`. Indentation is four spaces by convention — and you never have to maintain it by hand, because `rustfmt` does it for you. Try the **Format** button.",
      ),
      code: `fn main() {
    println!("Hello, world!");

    // Values can be dropped straight into a format string by name.
    let crab = "crab";
    println!("Rust's mascot is a {crab}.");

    // Anything goes on either side of the text, too.
    println!("2 + 2 = {}", 2 + 2);
}`,
      exercise: {
        prompt:
          "Add a third `println!` that prints exactly `Rust is fun` on its own line. Leave the existing lines alone.",
        expect: { contains: ["Rust is fun"] },
        hint: "`println!(\"Rust is fun\");` — the macro adds the newline for you.",
      },
    },

    {
      slug: "printing-and-formatting",
      title: "Printing and formatting",
      summary:
        "Positional and named arguments, Debug vs Display, padding, precision, and the other print macros.",
      tags: ["format!", "{:?}", "{:>8}", "eprintln!"],
      body: md(
        "`println!` and friends all share one format-string language.",
        "",
        "## Two ways to show a value",
        "",
        "- `{}` uses the **Display** trait: the tidy, user-facing form. You opt into it for your own types.",
        "- `{:?}` uses the **Debug** trait: the programmer-facing form, which you normally get for free with `#[derive(Debug)]`. `{:#?}` is the same thing pretty-printed over several lines.",
        "",
        "Most built-in collections only implement `Debug`, which is why printing a `Vec` needs `{:?}`.",
        "",
        "## Useful specifiers",
        "",
        "| Spec | Meaning |",
        "|---|---|",
        "| `{:>8}` | right-align in 8 columns |",
        "| `{:<8}` / `{:^8}` | left / centre align |",
        "| `{:08.3}` | pad with zeros, 3 decimal places |",
        "| `{:+}` | always show the sign |",
        "| `{:#x}` `{:#b}` `{:o}` | hex / binary / octal, `#` adds the prefix |",
        "| `{:e}` | scientific notation |",
        "",
        "## The family",
        "",
        "- `print!` — no trailing newline.",
        "- `println!` — with newline.",
        "- `eprint!` / `eprintln!` — the same, but to **stderr**. Diagnostics belong here so they do not pollute a program's real output.",
        "- `format!` — returns a `String` instead of printing. This is the one you will reach for most in real code.",
        "",
        "> Below, notice that the stderr line shows up in its own section of the output panel. The compiler's own messages arrive on stderr too.",
      ),
      code: `fn main() {
    let name = "Ferris";
    let version = 1.9900;

    // Named / inline arguments, then positional ones.
    println!("hello, {name}");
    println!("{0} meets {1}, and {1} meets {0}", "a", "b");

    // Display vs Debug.
    let scores = vec![10, 20, 30];
    println!("display: {}", name);
    println!("debug:   {scores:?}");
    println!("pretty:  {scores:#?}");

    // Width, alignment, precision.
    println!("[{:>10}]", name);
    println!("[{:<10}]", name);
    println!("[{:^10}]", name);
    println!("{:08.3}", version);
    println!("{:+} and {:#x} and {:#b}", 42, 255, 5);

    // The width itself can be a variable.
    let w = 14;
    println!("[{name:*^w$}]");

    // format! builds a String rather than printing.
    let line = format!("{name} v{version:.2}");
    println!("built: {line}");

    // Diagnostics go to stderr.
    eprintln!("note: this line went to stderr");
}`,
      exercise: {
        prompt:
          "Print the number `7` right-aligned in a field of 5 characters padded with zeros, so the output contains `00007`.",
        expect: { contains: ["00007"] },
        hint: "`println!(\"{:05}\", 7);`",
      },
    },

    {
      slug: "variables-and-mutability",
      title: "Variables and mutability",
      summary:
        "Why bindings are immutable by default, what `mut` really changes, and how type inference works.",
      tags: ["let", "mut", "inference"],
      body: md(
        "`let x = 5;` creates a binding — and by default you **cannot** reassign it. This is the first place Rust's bias shows: immutability is the default, and mutation is something you ask for explicitly with `mut`.",
        "",
        "That is not fussiness for its own sake. If a value cannot change, no other part of the program can change it behind your back, which removes a whole family of bugs and is a precondition for the thread-safety guarantees you will meet in module 8.",
        "",
        "## Type inference",
        "",
        "Rust is statically typed, but you rarely write the types out. The compiler infers them from how a value is used — yet it still infers *one* concrete type, fixed for the life of the binding:",
        "",
        "```rust",
        "let n = 5;        // inferred i32",
        "let n: u8 = 5;    // or say it explicitly",
        "let big = 5u64;   // or suffix the literal",
        "```",
        "",
        "Sometimes inference needs help — `\"42\".parse()` could produce any number type, so you must say which.",
        "",
        "## Declare now, assign later",
        "",
        "A `let` with no value is fine as long as the compiler can prove every path assigns it exactly once before you read it. Reading a possibly-uninitialised variable is a compile error, not undefined behaviour.",
        "",
        "> Uncomment the marked line below and run it. The error message names the exact binding and even suggests the fix. Getting comfortable *reading* these messages is most of learning Rust.",
      ),
      code: `fn main() {
    let x = 5;
    println!("x is {x}");

    // x = 6; // <-- uncomment me: "cannot assign twice to immutable variable"

    let mut y = 5;
    println!("y starts at {y}");
    y = 6;
    y += 10;
    println!("y is now {y}");

    // Inference picks one concrete type and sticks to it.
    let inferred = 5;          // i32
    let explicit: u8 = 5;      // you can always say it yourself
    let suffixed = 5_000u64;   // underscores are just visual separators
    println!("{inferred} {explicit} {suffixed}");

    // parse() is ambiguous on its own, so annotate the destination.
    let parsed: i32 = "42".parse().expect("not a number");
    let turbofished = "42".parse::<f64>().unwrap();
    println!("{parsed} {turbofished}");

    // Deferred initialisation: legal, because every branch assigns once.
    let label;
    if parsed > 40 {
        label = "big";
    } else {
        label = "small";
    }
    println!("{parsed} is {label}");
}`,
      exercise: {
        prompt:
          "Declare a binding `total` starting at 100, make it mutable, add 15 to it, and print `total: 115`.",
        expect: { contains: ["total: 115"] },
        hint: "Change `let total = 100;` to `let mut total = 100;`, then `total += 15;`.",
      },
    },

    {
      slug: "shadowing-and-constants",
      title: "Shadowing and constants",
      summary:
        "Rebinding a name to a new value — even a new type — and the two kinds of compile-time constant.",
      tags: ["shadowing", "const", "static"],
      body: md(
        "**Shadowing** is declaring a second binding with the same name. The new one hides the old one for the rest of the scope:",
        "",
        "```rust",
        "let spaces = \"   \";        // &str",
        "let spaces = spaces.len(); // usize — a different type, same name",
        "```",
        "",
        "This is genuinely different from `mut`. `mut` lets you change the value in one slot, keeping its type. Shadowing creates a brand new binding, so the type is free to change — which is why it is the idiomatic way to convert a value through a pipeline without inventing `input`, `input_trimmed`, `input_num`.",
        "",
        "A block is also an expression, so shadowing inside `{}` only lasts until the closing brace.",
        "",
        "## const and static",
        "",
        "```rust",
        "const MAX: u32 = 100_000;        // inlined at each use site",
        "static GREETING: &str = \"hi\";    // one fixed memory location",
        "```",
        "",
        "Both require an explicit type and a value computable at compile time. Differences worth knowing:",
        "",
        "- `const` has no address of its own — think \"a name for a literal\". Conventionally `SCREAMING_SNAKE_CASE`.",
        "- `static` does have a single fixed address and lives for the whole program. A **mutable** `static` is shared global state, so touching one requires `unsafe`.",
        "- Neither can ever be shadowed or reassigned, and both can be declared at module level, which `let` cannot.",
      ),
      code: `const MAX_POINTS: u32 = 100_000;
static UNIT: &str = "pts";

fn main() {
    // Shadowing: same name, new binding, new value.
    let x = 5;
    let x = x + 1;
    let x = x * 2;
    println!("x = {x}"); // 12

    // Shadowing can change the type. mut could not do this.
    let input = "  42  ";
    let input = input.trim();
    let input: i32 = input.parse().unwrap();
    println!("parsed to {}", input + 1);

    // A shadow inside a block disappears with the block.
    let y = 10;
    {
        let y = "inner";
        println!("inside the block, y is {y}");
    }
    println!("outside, y is still {y}");

    println!("cap: {MAX_POINTS} {UNIT}");

    // consts are usable in positions that need a compile-time value,
    // such as an array length.
    const N: usize = 4;
    let grid = [0u8; N];
    println!("grid has {} cells", grid.len());
}`,
      exercise: {
        prompt:
          "Using shadowing (not `mut`), turn the string `\"7\"` into a number and print `doubled: 14`.",
        expect: { contains: ["doubled: 14"] },
        hint: "`let n = \"7\"; let n: i32 = n.parse().unwrap(); println!(\"doubled: {}\", n * 2);`",
      },
    },

    {
      slug: "scalar-types",
      title: "Scalar types",
      summary:
        "Integers, floats, bool, char — plus overflow, integer division and the casting rules.",
      tags: ["i32", "u8", "f64", "char", "as"],
      body: md(
        "Rust has four families of scalar type.",
        "",
        "## Integers",
        "",
        "Signed `i8 i16 i32 i64 i128 isize`, unsigned `u8 u16 u32 u64 u128 usize`. The default is `i32`. `usize`/`isize` match the machine's pointer width and are what indexing and lengths use.",
        "",
        "**Overflow is not ignored.** In a debug build an overflowing `+` panics; in release it wraps. Relying on either is a bug, so Rust gives you explicit tools: `checked_add` (returns `Option`), `saturating_add` (clamps), `wrapping_add` (wraps on purpose), `overflowing_add` (value plus a flag).",
        "",
        "## Floats",
        "",
        "`f32` and `f64`, default `f64`, IEEE-754. They implement `PartialOrd` but not `Ord`, because `NaN` compares equal to nothing — including itself. That is why sorting floats needs `sort_by` with `partial_cmp`.",
        "",
        "## bool and char",
        "",
        "`bool` is `true`/`false`, one byte, and never implicitly converts to a number. A `char` is **four** bytes and holds one Unicode scalar value, so `'é'` and an emoji are each a single `char`.",
        "",
        "## Casting",
        "",
        "There are no implicit numeric conversions — not even `u8` to `u32`. Use `as` for a cheap, possibly-lossy cast, or `try_into()` when you want to be told about the loss.",
        "",
        "> Note `7 / 2` below. Integer division truncates; it does not round.",
      ),
      code: `fn main() {
    let a: i32 = -7;
    let b: u8 = 255;
    let big: u64 = 18_446_744_073_709_551_615;
    println!("{a} {b} {big}");

    // Ranges of a type are introspectable.
    println!("i32 spans {} ..= {}", i32::MIN, i32::MAX);

    // Overflow, handled four ways.
    println!("checked:     {:?}", b.checked_add(1));      // None
    println!("saturating:  {}", b.saturating_add(1));     // 255
    println!("wrapping:    {}", b.wrapping_add(1));       // 0
    println!("overflowing: {:?}", b.overflowing_add(1));  // (0, true)

    // Integer division truncates toward zero; % keeps the sign of the left side.
    println!("7 / 2 = {}  7 % 2 = {}", 7 / 2, 7 % 2);
    println!("as floats: {}", 7.0 / 2.0);

    // Floats.
    let f = 0.1_f64 + 0.2;
    println!("0.1 + 0.2 = {f}  (== 0.3? {})", f == 0.3);
    println!("rounded compare: {}", (f - 0.3).abs() < f64::EPSILON);
    // rustc lints against this comparison because it is almost always a bug.
    // We want to show the answer, so we silence it here and use is_nan() below.
    #[allow(invalid_nan_comparisons)]
    let nan_equals_itself = f64::NAN == f64::NAN;
    println!("nan == nan? {nan_equals_itself}  (so test with .is_nan() instead)");

    // bool and char.
    let ready: bool = 3 > 2;
    let letter = 'R';
    let crab = 'o';
    println!("{ready} {letter} {crab} — a char is {} bytes", size_of::<char>());

    // Explicit casts only.
    let n: u8 = 200;
    let widened = n as u32 * 2;
    let truncated = 300_i32 as u8; // 300 does not fit: wraps to 44
    println!("{widened} {truncated}");

    // try_into tells you when a cast would lose information.
    let attempt: Result<u8, _> = 300_i32.try_into();
    println!("300 into u8: {attempt:?}");
}`,
      exercise: {
        prompt:
          "`u8::MAX` is 255. Print the result of adding 10 to it **without panicking**, clamped to the maximum, so the output contains `clamped: 255`.",
        expect: { contains: ["clamped: 255"] },
        hint: "`println!(\"clamped: {}\", u8::MAX.saturating_add(10));`",
      },
    },

    {
      slug: "functions",
      title: "Functions, expressions and statements",
      summary:
        "Declaring functions, the difference between an expression and a statement, and why most Rust bodies have no `return`.",
      tags: ["fn", "->", "expressions", "unit"],
      body: md(
        "Functions are `fn`, `snake_case`, and — unlike local bindings — their parameter and return types are **always** written out. That is deliberate: a signature is a contract, and the compiler refuses to guess at it.",
        "",
        "```rust",
        "fn add(a: i32, b: i32) -> i32 {",
        "    a + b    // no semicolon, no `return`",
        "}",
        "```",
        "",
        "## Expressions vs statements",
        "",
        "This is the idea that makes Rust's syntax click:",
        "",
        "- An **expression** evaluates to a value. `5`, `a + b`, `if c { 1 } else { 2 }`, and a `{ ... }` block are all expressions.",
        "- A **statement** performs an action and evaluates to nothing. `let x = 5;` is a statement — which is why `let x = (let y = 5);` is nonsense.",
        "",
        "A semicolon *discards* an expression's value. So the final line of a function body, written without a semicolon, **is** the return value. `return` exists, but is reserved for leaving early.",
        "",
        "A function with no `->` returns `()`, the **unit** type: the zero-sized \"nothing useful\" value. Add a stray semicolon after the last expression and you will get `expected i32, found ()` — a very common beginner error, and now you know exactly what it means.",
        "",
        "Order does not matter: `main` can call a function declared below it.",
      ),
      code: `fn main() {
    println!("add(2, 3) = {}", add(2, 3));
    println!("classify(0) = {}", classify(0));
    println!("first_even(&[1, 3, 8, 9]) = {:?}", first_even(&[1, 3, 8, 9]));
    println!("first_even(&[1, 3, 5]) = {:?}", first_even(&[1, 3, 5]));

    // A block is an expression, so it can produce a value.
    let area = {
        let w = 3;
        let h = 4;
        w * h
    };
    println!("area = {area}");

    // if is an expression too — both arms must have the same type.
    let parity = if area % 2 == 0 { "even" } else { "odd" };
    println!("area is {parity}");

    greet("world"); // returns (), the unit type
}

/// The last expression, with no semicolon, is the return value.
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn classify(n: i32) -> &'static str {
    if n > 0 {
        "positive"
    } else if n < 0 {
        "negative"
    } else {
        "zero"
    }
}

/// return is for leaving early.
fn first_even(xs: &[i32]) -> Option<i32> {
    for &x in xs {
        if x % 2 == 0 {
            return Some(x);
        }
    }
    None
}

/// No arrow means this returns the unit type, ().
fn greet(who: &str) {
    println!("hello, {who}");
}`,
      exercise: {
        prompt:
          "Write a function `fn square(n: i32) -> i32` that returns `n * n` without using the `return` keyword, and call it so the program prints `square: 49`.",
        expect: { contains: ["square: 49"] },
        hint: "The body is just `n * n` with no semicolon. Then `println!(\"square: {}\", square(7));`",
      },
    },
  ],
};
