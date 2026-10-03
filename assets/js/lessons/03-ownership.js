import { md } from "./_util.js";

export default {
  id: "ownership",
  n: 3,
  title: "Ownership & borrowing",
  summary:
    "The idea that makes Rust Rust: moves, copies, references, the borrow rules, and why dangling pointers cannot happen.",
  lessons: [
    {
      slug: "ownership",
      title: "Ownership",
      summary:
        "Every value has exactly one owner, and memory is freed when that owner goes out of scope.",
      tags: ["ownership", "scope", "drop", "move"],
      body: md(
        "Here is the whole system in three rules:",
        "",
        "1. Every value has a variable that is its **owner**.",
        "2. There can be only one owner at a time.",
        "3. When the owner goes out of scope, the value is **dropped** — its memory is freed.",
        "",
        "Nothing else is required. No garbage collector, because the compiler already knows the exact point where each value dies. No `free()` calls for you to forget or double up on, because the compiler inserts them. This all happens at compile time, so it costs nothing at runtime.",
        "",
        "## Moves",
        "",
        "Rule 2 has a sharp consequence. Assigning a heap-owning value to a second variable does not copy it and does not create a second owner — it **moves** ownership, and the original binding becomes unusable:",
        "",
        "```rust",
        "let s1 = String::from(\"hi\");",
        "let s2 = s1;          // ownership moves to s2",
        "println!(\"{s1}\");      // error: value borrowed after move",
        "```",
        "",
        "Why so strict? If both `s1` and `s2` owned those heap bytes, both would free them at the end of scope — a double free, one of the classic ways C programs are exploited. Rust rules it out by construction.",
        "",
        "Passing a value to a function moves it in exactly the same way, unless the function takes a reference (next lesson but one).",
        "",
        "> The error for using a moved value is one you will see often, and it is worth reading properly: it points at the move, at the later use, and usually suggests `clone()` or a borrow. Uncomment the marked lines below to meet it.",
      ),
      code: `fn main() {
    // Scope: the String is dropped at the closing brace.
    {
        let s = String::from("short-lived");
        println!("inside the block: {s}");
    } // <- s is dropped here, heap memory freed

    // A move: ownership transfers, the old binding dies.
    let s1 = String::from("hello");
    let s2 = s1;
    println!("s2 = {s2}");
    // println!("s1 = {s1}"); // <-- uncomment: "borrow of moved value: s1"

    // Passing to a function also moves.
    let text = String::from("owned by main, for now");
    consume(text);
    // println!("{text}");   // <-- uncomment: same error, moved into consume

    // Returning a value moves ownership back out.
    let made = produce();
    println!("got back: {made}");

    // Give-and-take: move in, move out.
    let a = String::from("round");
    let a = round_trip(a);
    println!("still have: {a}");

    // Drop order is reverse of declaration; watch the Noisy values below.
    let _first = Noisy("first");
    let _second = Noisy("second");
    println!("end of main");
}

fn consume(s: String) {
    println!("consume now owns: {s}");
} // s dropped here

fn produce() -> String {
    String::from("made inside produce")
}

fn round_trip(s: String) -> String {
    println!("round_trip borrowed ownership of: {s}");
    s // move it back out
}

/// A type that announces its own destruction, so drops become visible.
struct Noisy(&'static str);

impl Drop for Noisy {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}`,
      exercise: {
        prompt:
          "The code below fails to compile because `name` is moved into `greet` and then used again. Fix it **without** changing `greet`'s signature, so the program prints `after: Ada`.\n\n```rust\nfn greet(n: String) { println!(\"hi {n}\"); }\nfn main() {\n    let name = String::from(\"Ada\");\n    greet(name);\n    println!(\"after: {name}\");\n}\n```",
        expect: { contains: ["after: Ada"], sourceContains: ["clone"] },
        hint: "Hand `greet` a copy: `greet(name.clone());`. The next lesson explains when cloning is the right call and when borrowing is better.",
      },
    },

    {
      slug: "move-clone-copy",
      title: "Move, Clone and Copy",
      summary:
        "Why integers behave differently from Strings, and what `clone()` actually costs.",
      tags: ["Copy", "Clone", "stack", "heap"],
      body: md(
        "Last lesson, moving a `String` invalidated the original. Yet this is perfectly fine:",
        "",
        "```rust",
        "let x = 5;",
        "let y = x;",
        "println!(\"{x} {y}\"); // both still usable",
        "```",
        "",
        "The difference is the `Copy` trait.",
        "",
        "## Copy",
        "",
        "A type is `Copy` when duplicating it is just duplicating its bits — no heap allocation, nothing to free, so a bitwise copy is a complete and independent value. Assigning such a type copies instead of moving, and the original stays valid.",
        "",
        "`Copy` types include all the integers and floats, `bool`, `char`, `&T` shared references, and tuples/arrays whose elements are all `Copy`.",
        "",
        "Crucially, a type **cannot** be `Copy` if it owns a resource that must be released. `String` owns a heap buffer, so copying the bits would give you two owners of one buffer — exactly the double-free that ownership exists to prevent. Hence `String` is not `Copy`. Same for `Vec<T>`, `Box<T>`, and anything that implements `Drop`.",
        "",
        "## Clone",
        "",
        "`Clone` is the explicit, possibly-expensive deep copy. `s.clone()` allocates a new buffer and copies the bytes, giving you a genuinely independent value. It is explicit precisely *because* it may be expensive — Rust will not silently allocate behind your back.",
        "",
        "`#[derive(Clone, Copy)]` on your own type opts in; `Copy` requires `Clone`, and only works if every field is itself `Copy`.",
        "",
        "> `clone()` is a legitimate tool, not a defeat. Reaching for it to get unstuck while learning is fine. But if a clone shows up in a hot loop, that is usually a sign a borrow would have been better.",
      ),
      code: `// Some shapes below exist only to show the syntax, so the dead-code
// lint is silenced for this snippet.
#![allow(dead_code)]

fn main() {
    // Copy types: assignment duplicates the bits, original stays valid.
    let x = 5;
    let y = x;
    println!("x={x} y={y}");

    let p = (1, 2.5, true); // all fields Copy, so the tuple is Copy
    let q = p;
    println!("{p:?} {q:?}");

    // Non-Copy: assignment moves.
    let s1 = String::from("heap");
    let s2 = s1.clone(); // explicit deep copy, so s1 survives
    println!("s1={s1} s2={s2}");

    // Copy types passed to functions are copied, not moved.
    let n = 42;
    takes_copy(n);
    println!("n is still {n}");

    // A derived Copy struct behaves like an integer.
    let a = Point { x: 1, y: 2 };
    let b = a;
    println!("{a:?} and {b:?} both usable");

    // A Clone-but-not-Copy struct must be cloned explicitly.
    let t1 = Tag { name: String::from("alpha") };
    let t2 = t1.clone();
    println!("{t1:?} {t2:?}");
    // let t3 = t1; println!("{t1:?}"); // <-- uncomment: moved, not copied

    // Cloning a collection clones every element.
    let v1 = vec![String::from("a"), String::from("b")];
    let mut v2 = v1.clone();
    v2.push(String::from("c"));
    println!("{v1:?} / {v2:?}");

    // Copy is about ownership, not size: a huge array is still Copy.
    let big = [0u64; 8];
    let also_big = big;
    println!("{} {}", big.len(), also_big.len());
}

#[derive(Debug, Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}

/// Contains a String, so it can be Clone but never Copy.
#[derive(Debug, Clone)]
struct Tag {
    name: String,
}

fn takes_copy(v: i32) {
    println!("takes_copy got {v}");
}`,
      exercise: {
        prompt:
          "Define `struct Speed(u32)` and derive the traits it needs so that after `let a = Speed(90); let b = a;` **both** `a` and `b` are still usable, then print `both: 90 90`.",
        expect: { contains: ["both: 90 90"], sourceContains: ["Copy"] },
        hint: "`#[derive(Debug, Clone, Copy)] struct Speed(u32);` — deriving `Copy` only works here because `u32` is itself `Copy`. Then print `a.0` and `b.0`.",
      },
    },

    {
      slug: "borrowing",
      title: "References and borrowing",
      summary:
        "Using a value without taking ownership of it — the everyday alternative to moving and cloning.",
      tags: ["&", "borrow", "deref", "immutable"],
      body: md(
        "Moving is restrictive and cloning costs an allocation. The usual answer is neither: **borrow** the value with a reference.",
        "",
        "```rust",
        "fn length(s: &String) -> usize { s.len() }",
        "",
        "let s = String::from(\"hello\");",
        "let n = length(&s);   // lend it out",
        "println!(\"{s} is {n}\"); // s is still ours",
        "```",
        "",
        "`&s` creates a reference — a pointer that *does not own* what it points to. When the reference goes out of scope, nothing is freed, because the reference never owned anything. The owner stays the owner.",
        "",
        "## What a reference guarantees",
        "",
        "A Rust reference is not a C pointer. It is guaranteed to be non-null and to point at a live, correctly-typed value, for as long as the reference exists. There is no such thing as a dangling `&T` — the compiler rejects programs that could produce one (last lesson of this module).",
        "",
        "## Dereferencing",
        "",
        "`*r` reaches through a reference to the value. In practice you write it less than you would expect, because of **auto-deref**: method calls follow references automatically, so `r.len()` works on a `&String` with no ceremony. You mostly need `*` when doing arithmetic on a `&i32`, or when assigning through a `&mut`.",
        "",
        "## Shared references are many and read-only",
        "",
        "You can hand out as many `&T` as you like at once. None of them can mutate what they point at — which is exactly why many readers are safe.",
        "",
        "> `&str` and `&[T]`, which you have used since module 2, are just borrowed views of this kind. You have been borrowing all along.",
      ),
      code: `fn main() {
    let s = String::from("hello");

    // Borrow instead of moving: s is still ours afterwards.
    println!("length of {s} is {}", length(&s));
    println!("first word: {}", first_word(&s));

    // Any number of shared borrows may coexist.
    let r1 = &s;
    let r2 = &s;
    let r3 = &r2; // a reference to a reference is fine too
    println!("{r1} {r2} {r3} and the owner {s}");

    // Dereferencing: usually implicit, occasionally explicit.
    let n = 10;
    let rn = &n;
    println!("{} {} {}", rn, *rn + 1, n);
    println!("equal? {}", *rn == n);

    // Auto-deref means method calls just work through references.
    let v = vec![3, 1, 2];
    let rv = &v;
    println!("len {} max {:?}", rv.len(), rv.iter().max());

    // Borrowing in a loop: the Vec is untouched afterwards.
    let names = vec![String::from("ana"), String::from("bo")];
    for name in &names {
        println!("hi {}", greet_ref(name));
    }
    println!("names still here: {names:?}");

    // Prefer &str over &String in parameters: it accepts strictly more.
    println!("{}", shout("a literal"));
    println!("{}", shout(&s));
}

fn length(s: &String) -> usize {
    s.len()
}

/// &str accepts a literal, a &String, or a slice of either.
fn shout(s: &str) -> String {
    s.to_uppercase()
}

fn greet_ref(s: &str) -> &str {
    s
}

fn first_word(s: &str) -> &str {
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}`,
      exercise: {
        prompt:
          "Write `fn total(v: &[i32]) -> i32` that sums a **borrowed** slice. Call it on `vec![1, 2, 3]` and then print the vector as well, so the output contains `total 6 of [1, 2, 3]` — borrowing is what makes that second use legal.",
        expect: { contains: ["total 6 of [1, 2, 3]"] },
        hint: "`fn total(v: &[i32]) -> i32 { v.iter().sum() }`, then `println!(\"total {} of {:?}\", total(&v), v);`. Had `total` taken `Vec<i32>` by value, `v` would be gone by the second use.",
      },
    },

    {
      slug: "mutable-borrows",
      title: "Mutable references & the borrow rules",
      summary:
        "One writer or many readers, never both — and the data races that rule eliminates.",
      tags: ["&mut", "aliasing", "NLL", "data race"],
      body: md(
        "`&mut T` is a reference you can write through. It comes with the single most important rule in the language:",
        "",
        "> At any given point, for any given value, you may have **either** any number of shared references `&T`, **or** exactly one mutable reference `&mut T`. Never both.",
        "",
        "To mutably borrow, the owner must itself be `mut`.",
        "",
        "## Why",
        "",
        "That rule is precisely the definition of a data race, banned at compile time. If a value can be written through only one path, and nothing else can even read it meanwhile, then:",
        "",
        "- no reader can observe a half-written value,",
        "- no iteration can be invalidated by a concurrent push,",
        "- and, in module 8, the same rule gives you thread safety for free rather than by discipline.",
        "",
        "It also unlocks optimisations: a `&mut` is guaranteed unaliased, which C compilers can only dream about (`restrict`).",
        "",
        "## Borrows end when last used, not at the brace",
        "",
        "This matters constantly in practice. The compiler tracks the *last use* of each reference (non-lexical lifetimes), so this is legal:",
        "",
        "```rust",
        "let r1 = &s;",
        "println!(\"{r1}\");   // r1's last use — its borrow ends here",
        "let r2 = &mut s;    // fine, nothing else is borrowing",
        "```",
        "",
        "Early Rust rejected that. If you read older material claiming borrows last to the end of the block, it is out of date.",
        "",
        "## Passing `&mut`",
        "",
        "You must write `&mut` at the call site as well as in the signature — mutation is never hidden from the reader.",
      ),
      code: `fn main() {
    let mut s = String::from("hello");

    // A mutable borrow lets a function change the value in place.
    append_world(&mut s);
    println!("{s}");

    // One &mut at a time.
    let m = &mut s;
    m.push('!');
    println!("{m}");
    // Many &T at a time.
    let r1 = &s;
    let r2 = &s;
    println!("{r1} {r2}");

    // Not both at once. Uncomment to see the classic error:
    // let shared = &s;
    // let exclusive = &mut s;
    // println!("{shared}");

    // Borrows end at their last use, so this sequence is fine.
    let mut v = vec![1, 2, 3];
    let first = v[0];           // copied out, no lingering borrow
    v.push(4);                  // so mutation is allowed here
    println!("{first} {v:?}");

    // ...whereas holding a borrow across a mutation is not:
    // let held = &v[0];
    // v.push(5);               // error: cannot borrow v as mutable
    // println!("{held}");

    // Mutating through a &mut element.
    if let Some(x) = v.get_mut(0) {
        *x = 100;
    }
    println!("{v:?}");

    // iter_mut hands out one &mut per element, safely.
    for x in v.iter_mut() {
        *x += 1;
    }
    println!("{v:?}");

    // Two disjoint mutable borrows of one slice, via split_at_mut.
    let mut data = [1, 2, 3, 4, 5, 6];
    let (left, right) = data.split_at_mut(3);
    left[0] = 10;
    right[0] = 40;
    println!("{data:?}");

    // Swapping through mutable references.
    let mut a = String::from("A");
    let mut b = String::from("B");
    std::mem::swap(&mut a, &mut b);
    println!("{a} {b}");
}

fn append_world(s: &mut String) {
    s.push_str(", world");
}`,
      exercise: {
        prompt:
          "Write `fn scale(xs: &mut Vec<i32>, factor: i32)` that multiplies every element in place, then call it on `vec![1, 2, 3]` with factor 3 so the output contains `[3, 6, 9]`.",
        expect: { contains: ["[3, 6, 9]"] },
        hint: "`for x in xs.iter_mut() { *x *= factor; }` and call it as `scale(&mut v, 3);`",
      },
    },

    {
      slug: "dangling-references",
      title: "Why dangling references cannot happen",
      summary:
        "The borrow checker's other job: making sure no reference outlives the value it points to.",
      tags: ["lifetimes", "dangling", "borrow checker"],
      body: md(
        "Borrowing solved \"who frees this?\". There is a second question: **can a reference outlive the thing it refers to?** In C the answer is yes, and that bug is called a use-after-free. In Rust the answer is no, and the compiler is the reason.",
        "",
        "```rust",
        "fn dangle() -> &String {",
        "    let s = String::from(\"oops\");",
        "    &s          // error[E0106]: missing lifetime specifier",
        "}               // s is dropped here — the reference would point at freed memory",
        "```",
        "",
        "The fix is to return the `String` itself, moving ownership out to the caller.",
        "",
        "## What the borrow checker actually tracks",
        "",
        "Every reference has a **lifetime**: the region of code over which it is valid. The rule is simply that a reference's lifetime must not exceed that of its referent. Usually this is inferred and invisible; you only write lifetimes out when a signature is ambiguous (module 6 covers that).",
        "",
        "## Returning a borrow is fine when it comes from the input",
        "",
        "```rust",
        "fn first_word(s: &str) -> &str   // the output borrows from s, so it is safe",
        "```",
        "",
        "The compiler infers that the returned reference lives as long as `s`, and holds you to it.",
        "",
        "## Reading E0597 and friends",
        "",
        "These errors always have the same shape: something is *borrowed*, something is *dropped*, and the borrow is used *after* that. The message labels all three lines. Find the drop point, and the fix is usually one of:",
        "",
        "- return an owned value instead of a reference,",
        "- move the owner so it lives long enough,",
        "- or restructure so the borrow finishes before the drop.",
        "",
        "> This is the feature nothing else quite has: memory safety with no runtime cost and no garbage collector. It is also why Rust feels hard at first — the compiler is making you resolve ambiguities up front that other languages let you discover in production.",
      ),
      code: `fn main() {
    // Safe: ownership is returned to the caller.
    let owned = no_dangle();
    println!("{owned}");

    // Safe: the returned reference borrows from the argument, so the compiler
    // knows exactly how long it may live.
    let sentence = String::from("borrow checking is static");
    println!("first word: {}", first_word(&sentence));
    println!("longest: {}", longest(&sentence, "short"));

    // A borrow must not outlive its referent. Uncomment to see E0597:
    // let outer;
    // {
    //     let inner = String::from("gone soon");
    //     outer = &inner;
    // } // inner dropped here
    // println!("{outer}");

    // The same mistake with a Vec element:
    let mut v = vec![1, 2, 3];
    let sum: i32 = v.iter().sum();   // the borrow ends on this line
    v.clear();                       // so clearing is allowed now
    println!("sum was {sum}, v is now {v:?}");

    // Scopes make lifetimes concrete: the reference dies with the block.
    let data = String::from("outer value");
    {
        let r = &data;
        println!("inside: {r}");
    }
    println!("outer still fine: {data}");
}

/// Returning the String itself moves ownership out — no reference, no problem.
fn no_dangle() -> String {
    String::from("safely owned by the caller")
}

/// The output borrows from the input, which the compiler can verify.
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

/// Two inputs, one borrowed output: here the lifetime must be spelled out,
/// because the compiler cannot guess which argument the result came from.
fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.len() >= b.len() {
        a
    } else {
        b
    }
}`,
      exercise: {
        prompt:
          "The function below cannot compile: the `String` it builds is dropped at the closing brace while the returned reference still points at it. Rewrite it to hand ownership to the caller instead, so the program prints `tag: #rust`.\n\n```rust\nfn make_tag(name: &str) -> &str {\n    let tag = format!(\"#{name}\");\n    &tag\n}\n```",
        expect: { contains: ["tag: #rust"] },
        hint: "Return `String` rather than `&str`, and return `tag` itself rather than `&tag`. The caller then owns the value, so it lives exactly as long as they need it.",
      },
    },
  ],
};
