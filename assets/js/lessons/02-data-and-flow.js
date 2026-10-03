import { md } from "./_util.js";

export default {
  id: "data-and-flow",
  n: 2,
  title: "Compound data & control flow",
  summary:
    "Tuples, arrays and slices, then if/loop/while/for and your first look at `match`.",
  lessons: [
    {
      slug: "tuples",
      title: "Tuples",
      summary:
        "Fixed-size, mixed-type groupings — and destructuring, which you will use everywhere.",
      tags: ["tuple", "destructuring", "()"],
      body: md(
        "A tuple glues a fixed number of values of possibly different types into one value. Its type *is* the list of its field types: `(i32, f64, char)`.",
        "",
        "```rust",
        "let point = (3, 4.5, 'z');",
        "let (x, y, z) = point;   // destructure",
        "let first = point.0;     // or index by position",
        "```",
        "",
        "Because the length is part of the type, `point.3` is a compile error rather than a runtime one, and the index must be a literal — you cannot loop over a tuple with a variable index.",
        "",
        "## Where tuples earn their keep",
        "",
        "- Returning more than one value from a function without inventing a struct.",
        "- Destructuring in `let`, in function parameters, and in `match` arms.",
        "- Iterating pairs: `.enumerate()` and `.zip()` both hand you tuples.",
        "- `()`, the empty tuple, is the unit type you met in the last lesson.",
        "- A one-element tuple needs a trailing comma: `(5,)`, not `(5)`.",
        "",
        "Use `_` to ignore a field you do not need, and `..` to ignore the rest.",
        "",
        "> Once a tuple has more than three fields, or the fields need names to be understandable, reach for a struct instead (module 4).",
      ),
      code: `fn main() {
    let tup: (i32, f64, char) = (500, 6.4, 'z');

    // Destructure the whole thing...
    let (a, b, c) = tup;
    println!("a={a} b={b} c={c}");

    // ...or index by position with a literal.
    println!("first={} third={}", tup.0, tup.2);

    // Ignore what you do not need.
    let (_, middle, _) = tup;
    let (first, ..) = tup;
    println!("middle={middle} first={first}");

    // Returning two values at once.
    let (q, r) = divmod(17, 5);
    println!("17 = 5*{q} + {r}");

    // Nested tuples destructure just as happily.
    let nested = ((1, 2), (3, 4));
    let ((p, q2), (r2, s)) = nested;
    println!("{p} {q2} {r2} {s}");

    // Tuples compare and print as a whole, field by field.
    println!("{:?} sorted-ish: {}", nested, (1, 9) < (2, 0));

    // enumerate and zip both yield tuples.
    let names = ["ana", "bo", "cy"];
    let ages = [31, 24, 45];
    for (i, (name, age)) in names.iter().zip(ages.iter()).enumerate() {
        println!("{i}: {name} is {age}");
    }

    // Swapping, without a temporary.
    let mut x = 1;
    let mut y = 2;
    (x, y) = (y, x);
    println!("swapped: {x} {y}");
}

fn divmod(n: i32, d: i32) -> (i32, i32) {
    (n / d, n % d)
}`,
      exercise: {
        prompt:
          "Write `fn min_max(xs: &[i32]) -> (i32, i32)` returning the smallest and largest value, and print it for `[4, -2, 9, 7]` so the output contains `(-2, 9)`.",
        expect: { contains: ["(-2, 9)"] },
        hint: "`let lo = *xs.iter().min().unwrap();` and the same with `max()`. Then `println!(\"{:?}\", min_max(&[4, -2, 9, 7]));`",
      },
    },

    {
      slug: "arrays-and-slices",
      title: "Arrays and slices",
      summary:
        "Fixed-length arrays on the stack, borrowed views into them, and bounds checking.",
      tags: ["[T; N]", "&[T]", "slice", "bounds check"],
      body: md(
        "An **array** is `[T; N]`: `N` values of one type `T`, with `N` baked into the type and known at compile time. Arrays live on the stack and never resize. `[3, 3, 3]` and `[3; 3]` are the same array.",
        "",
        "A **slice** `&[T]` is a borrowed window onto a contiguous run of values — a pointer plus a length, created with a range: `&arr[1..4]`. It does not own anything and does not copy; it points into the original.",
        "",
        "## Range syntax",
        "",
        "`1..4` is half-open (1, 2, 3). `1..=4` includes 4. `..3`, `2..` and `..` leave an end open.",
        "",
        "## Bounds are always checked",
        "",
        "Indexing out of range panics — it does not read adjacent memory. This is the trade Rust makes: a tiny check in exchange for the entire class of buffer-overrun vulnerabilities. When you would rather handle the miss than crash, use `.get(i)`, which returns an `Option`.",
        "",
        "## Why functions take `&[T]`",
        "",
        "A function taking `&[i32]` accepts a slice of an array, a slice of a `Vec`, or the whole of either — one signature, every caller. A function taking `[i32; 3]` only ever works for arrays of exactly three. Prefer slices in parameters.",
      ),
      code: `fn main() {
    let a = [1, 2, 3, 4, 5];
    let zeros = [0u8; 4];        // four zeros
    println!("{a:?} {zeros:?} len={}", a.len());

    // Slices are borrowed views: no copying.
    let middle = &a[1..4];
    println!("middle   {middle:?}");
    println!("from 2   {:?}", &a[2..]);
    println!("up to 2  {:?}", &a[..2]);
    println!("all      {:?}", &a[..]);
    println!("inclusive{:?}", &a[1..=3]);

    // Checked access instead of a panic.
    println!("a.get(1)  = {:?}", a.get(1));
    println!("a.get(99) = {:?}", a.get(99));
    // println!("{}", a[99]); // <-- uncomment: panics with "index out of bounds"

    // Handy slice methods.
    println!("first={:?} last={:?}", a.first(), a.last());
    println!("sum={} max={:?}", a.iter().sum::<i32>(), a.iter().max());
    println!("contains 3? {}", a.contains(&3));

    // One signature, two kinds of caller.
    let v: Vec<i32> = vec![10, 20, 30];
    println!("array total {} / vec total {}", total(&a), total(&v));

    // Mutating through a mutable slice writes into the original.
    let mut b = [5, 1, 4, 2, 3];
    b.sort();
    println!("sorted {b:?}");
    double_all(&mut b[1..4]);
    println!("middle doubled {b:?}");

    // 2D arrays are just arrays of arrays.
    let grid = [[1, 2, 3], [4, 5, 6]];
    for row in &grid {
        println!("row {row:?} sums to {}", row.iter().sum::<i32>());
    }
}

fn total(xs: &[i32]) -> i32 {
    xs.iter().sum()
}

fn double_all(xs: &mut [i32]) {
    for x in xs.iter_mut() {
        *x *= 2;
    }
}`,
      exercise: {
        prompt:
          "Given `let data = [10, 20, 30, 40, 50];`, print the sum of only the **last three** elements, so the output contains `sum: 120`.",
        expect: { contains: ["sum: 120"] },
        hint: "Slice first, then sum: `println!(\"sum: {}\", data[2..].iter().sum::<i32>());`",
      },
    },

    {
      slug: "if-expressions",
      title: "if, else and conditional expressions",
      summary:
        "Conditions must be bools, and `if` produces a value you can bind.",
      tags: ["if", "else if", "expression"],
      body: md(
        "Two rules cover almost everything:",
        "",
        "1. **The condition must be a `bool`.** `if 5 { }` does not compile. There is no truthiness in Rust — no zero-is-false, no empty-string-is-false. If you mean \"is it non-zero\", write `n != 0`.",
        "2. **`if` is an expression.** It evaluates to the value of whichever branch ran, so you can bind it directly. When you do, every arm must produce the same type, and you need an `else` — otherwise what would the value be when the condition is false?",
        "",
        "```rust",
        "let size = if n > 100 { \"big\" } else { \"small\" };",
        "```",
        "",
        "Parentheses around the condition are not used. Braces are never optional, which neatly rules out the dangling-else and goto-fail bugs.",
        "",
        "There is no ternary operator, because `if`/`else` already is one.",
        "",
        "## When you have more than two cases",
        "",
        "A long `else if` chain is usually a `match` wearing a disguise — and `match` has the advantage of checking that you covered everything. You will meet it two lessons from now.",
      ),
      code: `fn main() {
    let n = 7;

    if n % 2 == 0 {
        println!("{n} is even");
    } else {
        println!("{n} is odd");
    }

    // if as an expression: both arms must agree on a type.
    let label = if n > 100 {
        "big"
    } else if n > 5 {
        "medium"
    } else {
        "small"
    };
    println!("{n} is {label}");

    // No truthiness: say what you mean.
    let name = "";
    if !name.is_empty() {
        println!("hello, {name}");
    } else {
        println!("no name given");
    }

    // Conditions are ordinary expressions, so they compose.
    let temp = 31;
    let humid = true;
    if temp > 28 && humid {
        println!("muggy");
    }

    // An if arm can be a whole block that ends in a value.
    let fee = if n < 3 {
        0
    } else {
        let base = 10;
        base * n
    };
    println!("fee = {fee}");

    // Mixing types in the arms is a compile error. Uncomment to see it:
    // let bad = if n > 0 { 1 } else { "negative" };

    println!("{}", fizzbuzz(15));
    println!("{}", fizzbuzz(9));
    println!("{}", fizzbuzz(7));
}

fn fizzbuzz(n: u32) -> String {
    if n % 15 == 0 {
        "FizzBuzz".to_string()
    } else if n % 3 == 0 {
        "Fizz".to_string()
    } else if n % 5 == 0 {
        "Buzz".to_string()
    } else {
        n.to_string()
    }
}`,
      exercise: {
        prompt:
          "Bind a variable `verdict` using a single `if`/`else` expression so that a score of `72` prints `verdict: pass` (pass is 60 or above, otherwise fail).",
        expect: { contains: ["verdict: pass"] },
        hint: "`let verdict = if score >= 60 { \"pass\" } else { \"fail\" };`",
      },
    },

    {
      slug: "loops",
      title: "loop, while and for",
      summary:
        "Three loops, breaking with a value, and labelled loops for breaking out of nesting.",
      tags: ["loop", "while", "for", "break", "labels"],
      body: md(
        "## `loop`",
        "",
        "Repeats until you `break`. Unusually, `break` can carry a value out, which makes `loop` an expression — perfect for retry-until-success:",
        "",
        "```rust",
        "let answer = loop {",
        "    attempts += 1;",
        "    if attempts == 3 { break attempts * 10; }",
        "};",
        "```",
        "",
        "## `while`",
        "",
        "Checks a condition before each pass. Nothing surprising.",
        "",
        "## `for`",
        "",
        "Iterates anything iterable, and this is the one you should reach for by default. `for i in 0..5` walks a range; `for x in &collection` walks a collection by reference. Because the iterator produces the elements, there is no index to get wrong and no bounds check to pay for.",
        "",
        "Three ways to loop over a collection, and the difference matters:",
        "",
        "| Form | You get | The collection afterwards |",
        "|---|---|---|",
        "| `for x in &v` | `&T`, a shared reference | still usable |",
        "| `for x in &mut v` | `&mut T`, writeable | still usable |",
        "| `for x in v` | `T`, owned | **consumed** |",
        "",
        "That last row is a move — the subject of module 3.",
        "",
        "## Labels",
        "",
        "Prefix a loop with `'name:` and you can `break 'name` or `continue 'name` to target an outer loop from inside a nested one. Rust has no `goto`, and this is why it does not need one.",
      ),
      code: `fn main() {
    // loop + break with a value.
    let mut attempts = 0;
    let result = loop {
        attempts += 1;
        if attempts * attempts > 50 {
            break attempts;
        }
    };
    println!("first n where n*n > 50: {result}");

    // while.
    let mut countdown = 3;
    while countdown > 0 {
        println!("{countdown}...");
        countdown -= 1;
    }
    println!("liftoff");

    // for over a range.
    for i in 1..=5 {
        print!("{i} ");
    }
    println!();

    // Ranges can step and reverse.
    for i in (0..10).step_by(3) {
        print!("{i} ");
    }
    println!();
    for i in (1..=3).rev() {
        print!("{i} ");
    }
    println!();

    // for over a collection, three ways.
    let mut v = vec![1, 2, 3];
    for x in &v {
        print!("{x} ");
    }
    println!();
    for x in &mut v {
        *x *= 10;
    }
    println!("{v:?}");

    // continue skips the rest of this pass.
    for i in 1..=10 {
        if i % 3 != 0 {
            continue;
        }
        print!("{i} ");
    }
    println!();

    // Labelled loops: break out of the outer one from inside the inner.
    let grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    let target = 5;
    let mut found = None;
    'rows: for (r, row) in grid.iter().enumerate() {
        for (c, &cell) in row.iter().enumerate() {
            if cell == target {
                found = Some((r, c));
                break 'rows;
            }
        }
    }
    println!("{target} is at {found:?}");
}`,
      exercise: {
        prompt:
          "Use a `for` loop to sum every multiple of 3 below 20 and print `total: 63`.",
        expect: { contains: ["total: 63"] },
        hint: "`let mut total = 0; for i in 1..20 { if i % 3 == 0 { total += i; } }`",
      },
    },

    {
      slug: "match-basics",
      title: "match",
      summary:
        "Rust's pattern-matching conditional, and the exhaustiveness check that makes it safe.",
      tags: ["match", "=>", "exhaustive", "_"],
      body: md(
        "`match` compares a value against a series of patterns and runs the first arm that fits. It looks like a `switch` and behaves like something considerably stronger.",
        "",
        "```rust",
        "match n {",
        "    1 => \"one\",",
        "    2 | 3 => \"a couple\",",
        "    4..=9 => \"several\",",
        "    _ => \"many\",",
        "}",
        "```",
        "",
        "## The exhaustiveness check",
        "",
        "This is the headline feature. A `match` must cover **every** possible value, and the compiler proves it. Forget a case and the program does not build.",
        "",
        "That is what turns `match` from a convenience into a refactoring tool: add a variant to an enum later, and the compiler immediately lists every `match` in the codebase that now has a hole. No silent fall-through to a default branch that quietly does the wrong thing.",
        "",
        "`_` is the catch-all. Use it when you genuinely mean \"everything else\" — but be aware you are switching the exhaustiveness check off for that value.",
        "",
        "## What you can write in a pattern",
        "",
        "- literals, and `|` for alternatives",
        "- ranges: `4..=9`",
        "- bindings: `n => ...` captures the value; `n @ 1..=5` captures *and* range-checks",
        "- guards: `n if n < 0 => ...` adds an arbitrary condition",
        "- destructuring of tuples, structs, enums and slices (lesson 4.5 goes deep on this)",
        "",
        "`match` is an expression, so every arm must produce the same type.",
      ),
      code: `fn main() {
    for n in [1, 2, 5, 42, -3] {
        println!("{n:>3} -> {}", describe(n));
    }

    // Matching a tuple, with a guard and a binding.
    for point in [(0, 0), (3, 0), (0, 4), (2, 2), (5, -5)] {
        println!("{point:?} is {}", where_is(point));
    }

    // Slice patterns.
    for xs in [vec![], vec![1], vec![1, 2], vec![1, 2, 3, 4]] {
        println!("{xs:?} -> {}", summarise(&xs));
    }

    // match as an expression, assigned straight to a binding.
    let http = 404;
    let meaning = match http {
        200 => "ok",
        301 | 302 => "redirect",
        400..=499 => "you broke it",
        500..=599 => "we broke it",
        _ => "unknown",
    };
    println!("{http} means: {meaning}");
}

fn describe(n: i32) -> String {
    match n {
        0 => "zero".to_string(),
        1 => "one".to_string(),
        2 | 3 => "a couple".to_string(),
        4..=9 => "several".to_string(),
        // "n @ pattern" binds the value and range-checks it at once.
        big @ 10..=99 => format!("two digits ({big})"),
        // A guard is any extra condition.
        neg if neg < 0 => format!("negative ({})", neg.abs()),
        _ => "lots".to_string(),
    }
}

fn where_is(point: (i32, i32)) -> &'static str {
    match point {
        (0, 0) => "the origin",
        (_, 0) => "on the x axis",
        (0, _) => "on the y axis",
        (x, y) if x == y => "on the diagonal",
        _ => "somewhere else",
    }
}

fn summarise(xs: &[i32]) -> String {
    match xs {
        [] => "empty".to_string(),
        [only] => format!("just {only}"),
        [a, b] => format!("a pair: {a} and {b}"),
        [first, .., last] => format!("{} items, {first}..{last}", xs.len()),
    }
}`,
      exercise: {
        prompt:
          "Write a `match` on `day` (an `u32`) that prints `kind: weekend` for 6 and 7, and `kind: weekday` for 1 through 5. Test it with `day = 6`.",
        expect: { contains: ["kind: weekend"] },
        hint: "`let kind = match day { 6 | 7 => \"weekend\", 1..=5 => \"weekday\", _ => \"invalid\" };`",
      },
    },

    {
      slug: "strings-and-str",
      title: "String and &str",
      summary:
        "The two string types, why there are two, and how to move between them.",
      tags: ["String", "&str", "to_string", "borrowing"],
      body: md(
        "Rust's two main string types trip up every newcomer, so here is the whole idea in one table:",
        "",
        "| | `String` | `&str` |",
        "|---|---|---|",
        "| Owns its bytes | yes | no — it borrows |",
        "| Growable | yes | no, fixed view |",
        "| Lives where | the heap | anywhere: the binary, a `String`, a stack buffer |",
        "| Think of it as | `Vec<u8>` of UTF-8 | a read-only window onto UTF-8 |",
        "",
        "A literal like `\"hello\"` is a `&'static str` — a borrowed view into text baked into your executable. `String::from(\"hello\")` copies those bytes onto the heap so they can grow.",
        "",
        "## The rule of thumb",
        "",
        "**Take `&str` in parameters, return `String` when you built something new.** A `&str` parameter accepts both types (a `&String` coerces automatically), so it is the strictly more useful choice.",
        "",
        "```rust",
        "fn shout(s: &str) -> String { s.to_uppercase() }",
        "shout(\"hi\");              // &str  — fine",
        "shout(&String::from(\"hi\")); // &String — coerces, also fine",
        "```",
        "",
        "## Converting",
        "",
        "- `&str` to `String`: `.to_string()`, `.to_owned()`, `String::from(s)`, `format!(\"{s}\")` — all equivalent in effect.",
        "- `String` to `&str`: `&s`, `s.as_str()`, or just pass it where a `&str` is wanted.",
        "",
        "Strings are UTF-8 and therefore **cannot be indexed by integer** — `s[0]` does not compile, because byte 0 of a multi-byte character is meaningless on its own. Lesson 5.3 covers what to do instead.",
      ),
      code: `fn main() {
    // A literal is a borrowed view into the binary itself.
    let literal: &str = "hello";

    // A String owns heap bytes and can grow.
    let mut owned: String = String::from("hello");
    owned.push(' ');
    owned.push_str("world");
    owned += "!";
    println!("{literal} / {owned}");

    // &String coerces to &str automatically, so one signature serves both.
    println!("{}", shout(literal));
    println!("{}", shout(&owned));

    // Every way of going from &str to String.
    let a = literal.to_string();
    let b = literal.to_owned();
    let c = String::from(literal);
    let d = format!("{literal}");
    println!("{} {} {} {}", a == b, b == c, c == d, d == a);

    // Slicing a string gives a &str — byte offsets, not character counts.
    let s = String::from("hello world");
    println!("[{}] [{}]", &s[0..5], &s[6..]);

    // Common operations.
    println!("len in bytes: {}", s.len());
    println!("upper: {}", s.to_uppercase());
    println!("replace: {}", s.replace("world", "rust"));
    println!("contains 'lo w': {}", s.contains("lo w"));
    println!("starts with hello: {}", s.starts_with("hello"));
    println!("trimmed: [{}]", "  padded  ".trim());
    println!("split: {:?}", s.split(' ').collect::<Vec<&str>>());
    println!("words reversed: {}", reverse_words(&s));

    // Joining and building.
    let parts = vec!["a", "b", "c"];
    println!("joined: {}", parts.join("-"));
    let built: String = (1..=3).map(|n| n.to_string()).collect::<Vec<_>>().join(",");
    println!("built: {built}");

    // Comparing across the two types works as you would hope.
    println!("equal? {}", owned == "hello world!");
}

/// Takes the borrowed form, returns the owned form: the usual shape.
fn shout(s: &str) -> String {
    format!("{}!", s.to_uppercase())
}

fn reverse_words(s: &str) -> String {
    s.split_whitespace().rev().collect::<Vec<&str>>().join(" ")
}`,
      exercise: {
        prompt:
          "Write `fn initials(full_name: &str) -> String` that turns `\"ada lovelace\"` into `AL`, and print `initials: AL`.",
        expect: { contains: ["initials: AL"] },
        hint: "Split on whitespace, take the first `char` of each word, uppercase it, and collect into a `String`: `full_name.split_whitespace().filter_map(|w| w.chars().next()).map(|c| c.to_ascii_uppercase()).collect()`",
      },
    },
  ],
};
