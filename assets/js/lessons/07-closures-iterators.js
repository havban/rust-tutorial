import { md } from "./_util.js";

export default {
  id: "closures-iterators",
  n: 7,
  title: "Closures, iterators & smart pointers",
  summary:
    "Functional Rust — closures and the iterator pipeline — then Box, Rc, RefCell, Deref and Drop.",
  lessons: [
    {
      slug: "closures",
      title: "Closures",
      summary:
        "Anonymous functions that capture their environment, and the three Fn traits.",
      tags: ["closure", "move", "Fn", "FnMut", "FnOnce"],
      body: md(
        "A closure is an anonymous function that can **capture** variables from the scope where it was written:",
        "",
        "```rust",
        "let factor = 3;",
        "let scale = |x| x * factor;   // factor is captured",
        "println!(\"{}\", scale(5));      // 15",
        "```",
        "",
        "Types are usually inferred from the first use, so you rarely annotate them. Unlike a `fn`, a closure has an anonymous type unique to itself — which is why returning one needs `impl Fn(..)` or `Box<dyn Fn(..)>`.",
        "",
        "## How capture is chosen",
        "",
        "Rust borrows as weakly as it can get away with, in this order:",
        "",
        "1. by shared reference `&T`, if reading suffices,",
        "2. by mutable reference `&mut T`, if the body mutates,",
        "3. by value, if the body needs ownership.",
        "",
        "`move` before the `|` forces capture by value. That is what you need to send a closure to another thread or return it from a function, since a borrow would not outlive the call.",
        "",
        "## The three traits",
        "",
        "| Trait | Can be called | Captures |",
        "|---|---|---|",
        "| `FnOnce` | at least once | may consume them |",
        "| `FnMut` | many times, needs `mut` | may mutate them |",
        "| `Fn` | many times | only reads them |",
        "",
        "They nest: every `Fn` is also `FnMut` and `FnOnce`. A closure implements the most permissive set its body allows, and parameters should ask for the weakest thing they need — `impl Fn(i32) -> i32` accepts fewer closures than `impl FnOnce(..)`.",
        "",
        "> Plain `fn` items also implement all three, so `map(double)` works wherever `map(|x| double(x))` does.",
      ),
      code: `fn main() {
    // Capture by shared borrow: factor is only read.
    let factor = 3;
    let scale = |x: i32| x * factor;
    println!("scale(5) = {}", scale(5));
    println!("factor is still usable: {factor}");

    // Capture by mutable borrow.
    let mut count = 0;
    let mut tick = || {
        count += 1;
        count
    };
    println!("{} {} {}", tick(), tick(), tick());
    println!("count ended at {count}");

    // move forces capture by value.
    let name = String::from("ada");
    let greet = move || format!("hello, {name}");
    println!("{}", greet());
    println!("{}", greet()); // Fn, so callable repeatedly
    // println!("{name}");   // <-- uncomment: moved into the closure

    // A closure that consumes what it captured is FnOnce only.
    let payload = String::from("one shot");
    let consume = move || payload; // returns it by value
    println!("{}", consume());
    // consume();  // <-- uncomment: cannot call an FnOnce twice

    // Closures as arguments: ask for the weakest trait that works.
    println!("apply:      {}", apply(4, |x| x * x));
    println!("apply twice:{}", apply_twice(4, |x| x + 10));
    println!("tally:      {}", tally(&[1, 2, 3], |acc, x| acc + x * x));

    // Returning a closure: its type is anonymous, so use impl Fn.
    let add_five = adder(5);
    println!("add_five(10) = {}", add_five(10));

    // Boxed closures can be stored in a collection together.
    let ops: Vec<(&str, Box<dyn Fn(i32) -> i32>)> = vec![
        ("double", Box::new(|x| x * 2)),
        ("negate", Box::new(|x| -x)),
        ("add factor", Box::new(move |x| x + factor)),
    ];
    for (label, op) in &ops {
        println!("{label:>10}(7) = {}", op(7));
    }

    // A memoising counter: FnMut holding state across calls.
    let mut seen = Vec::new();
    let mut record = |x: i32| {
        seen.push(x);
        seen.len()
    };
    record(1);
    record(2);
    println!("recorded {} values", record(3));

    // Function pointers work anywhere a closure does.
    println!("with a fn item: {:?}", [1, 2, 3].map(double));

    // Closures are what make the iterator pipeline work.
    let words = ["apple", "fig", "banana"];
    let mut sorted = words;
    sorted.sort_by_key(|w| w.len());
    println!("by length: {sorted:?}");
    println!("longest: {:?}", words.iter().max_by_key(|w| w.len()));
}

fn double(x: i32) -> i32 {
    x * 2
}

/// Fn: called once here, but asking for Fn accepts the most closures that read.
fn apply<F: Fn(i32) -> i32>(value: i32, f: F) -> i32 {
    f(value)
}

/// Needs to call f twice, so Fn (not FnOnce) is required.
fn apply_twice(value: i32, f: impl Fn(i32) -> i32) -> i32 {
    f(f(value))
}

/// A fold written by hand, to show the closure's shape.
fn tally<F>(items: &[i32], f: F) -> i32
where
    F: Fn(i32, i32) -> i32,
{
    let mut acc = 0;
    for &item in items {
        acc = f(acc, item);
    }
    acc
}

/// move is required: the closure outlives this call, so it cannot borrow n.
fn adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n
}`,
      exercise: {
        prompt:
          "Create a closure `area` that captures a variable `width = 4` and multiplies its argument by it, then print `area: 20` by calling it with 5.",
        expect: { contains: ["area: 20"] },
        hint: "`let width = 4; let area = |h| h * width; println!(\"area: {}\", area(5));`",
      },
    },

    {
      slug: "iterators",
      title: "Iterators",
      summary:
        "The `Iterator` trait, laziness, and the three ways to iterate a collection.",
      tags: ["Iterator", "next", "lazy", "iter vs into_iter"],
      body: md(
        "The entire `Iterator` trait requires one method:",
        "",
        "```rust",
        "trait Iterator {",
        "    type Item;",
        "    fn next(&mut self) -> Option<Self::Item>;",
        "}",
        "```",
        "",
        "`next` yields `Some(item)` until it is exhausted, then `None`. Everything else — `map`, `filter`, `zip`, `take`, `rev`, seventy more — is a default method built on top of it.",
        "",
        "## Laziness",
        "",
        "Adapters do **nothing** until something consumes them. `v.iter().map(expensive)` performs zero work; it builds a struct that *will* call `expensive` when asked. Consumers — `collect`, `sum`, `for`, `count`, `find`, `fold` — are what drive the loop.",
        "",
        "This is why chaining is efficient: there are no intermediate collections. The whole chain compiles down to roughly the loop you would have written by hand, often with the bounds checks eliminated.",
        "",
        "## iter vs iter_mut vs into_iter",
        "",
        "| Method | Item type | Collection after |",
        "|---|---|---|",
        "| `.iter()` | `&T` | untouched |",
        "| `.iter_mut()` | `&mut T` | mutable in place |",
        "| `.into_iter()` | `T` | consumed |",
        "",
        "`for x in &v` is `iter()`, `for x in &mut v` is `iter_mut()`, and `for x in v` is `into_iter()`. That is the whole of the `IntoIterator` trait's job.",
        "",
        "A consequence worth remembering: iterating `&v` of `String`s gives `&String`, so comparisons need `*s == \"x\"` or `s.as_str() == \"x\"`.",
        "",
        "> `.iter()` on a `HashMap` yields `(&K, &V)` tuples; on a `&[T]` it yields `&T`. When a closure parameter looks like it has one reference too many, that is usually why.",
      ),
      code: `fn main() {
    let v = vec![1, 2, 3];

    // Driving an iterator by hand.
    let mut it = v.iter();
    println!("{:?} {:?} {:?} {:?}", it.next(), it.next(), it.next(), it.next());

    // Adapters are lazy: nothing is printed until a consumer runs.
    println!("building the chain...");
    let lazy = v.iter().map(|x| {
        println!("  mapping {x}");
        x * 10
    });
    println!("nothing happened yet");
    let result: Vec<i32> = lazy.collect();
    println!("now it has: {result:?}");

    // Three ways to iterate.
    let mut nums = vec![1, 2, 3];
    let doubled: Vec<i32> = nums.iter().map(|x| x * 2).collect();
    println!("iter:      {doubled:?}, original intact {nums:?}");
    for x in nums.iter_mut() {
        *x += 100;
    }
    println!("iter_mut:  {nums:?}");
    let owned: Vec<i32> = nums.into_iter().filter(|x| x % 2 == 1).collect();
    println!("into_iter: {owned:?} (the original is gone)");

    // Consumers.
    let data = vec![4, 8, 15, 16, 23, 42];
    println!("sum     {}", data.iter().sum::<i32>());
    println!("product {}", data.iter().take(3).product::<i32>());
    println!("count   {}", data.iter().filter(|x| **x > 10).count());
    println!("max/min {:?} {:?}", data.iter().max(), data.iter().min());
    println!("any>40  {}", data.iter().any(|x| *x > 40));
    println!("all even{}", data.iter().all(|x| x % 2 == 0));
    println!("find    {:?}", data.iter().find(|x| **x > 10));
    println!("position{:?}", data.iter().position(|x| *x == 16));
    println!("last    {:?}", data.iter().last());
    println!("nth(2)  {:?}", data.iter().nth(2));

    // fold and reduce.
    let joined = data.iter().fold(String::new(), |mut acc, n| {
        if !acc.is_empty() {
            acc.push('-');
        }
        acc.push_str(&n.to_string());
        acc
    });
    println!("folded  {joined}");
    println!("reduce  {:?}", data.iter().copied().reduce(|a, b| a.max(b)));

    // Ranges, repeats and infinite iterators made finite.
    println!("range    {:?}", (1..5).collect::<Vec<i32>>());
    println!("step     {:?}", (0..20).step_by(5).collect::<Vec<i32>>());
    println!("repeat   {:?}", std::iter::repeat("ab").take(3).collect::<Vec<&str>>());
    println!("successors {:?}", powers_of_two(6));
    println!("once+chain {:?}",
        std::iter::once(0).chain(1..4).collect::<Vec<i32>>());

    // Iterating a String yields chars, not bytes.
    let word = "rust";
    println!("chars {:?}", word.chars().collect::<Vec<char>>());
    println!("rev   {}", word.chars().rev().collect::<String>());

    // Iterating &Vec<String> gives &String: note the deref in the comparison.
    let names = vec!["ada".to_string(), "bo".to_string()];
    println!("has ada? {}", names.iter().any(|n| n == "ada"));
    println!("lengths {:?}", names.iter().map(|n| n.len()).collect::<Vec<usize>>());
}

/// An infinite sequence, bounded by take.
fn powers_of_two(n: usize) -> Vec<u64> {
    std::iter::successors(Some(1u64), |prev| Some(prev * 2))
        .take(n)
        .collect()
}`,
      exercise: {
        prompt:
          "Using one iterator chain over `1..=10`, sum the squares of only the odd numbers and print `sum: 165`.",
        expect: { contains: ["sum: 165"] },
        hint: "`(1..=10).filter(|n| n % 2 == 1).map(|n| n * n).sum::<i32>()`",
      },
    },

    {
      slug: "iterator-adapters",
      title: "The adapter toolbox",
      summary:
        "map, filter, zip, flat_map, chunks, scan, peekable, windows — the chains you will write daily.",
      tags: ["map", "filter_map", "zip", "flat_map", "collect"],
      body: md(
        "Once `next()` exists, the adapters do the work. These are the ones that earn their keep.",
        "",
        "## Transforming",
        "",
        "- `map(f)` — one in, one out.",
        "- `filter(p)` — keep what matches. The closure gets a *reference*, hence the `**x` you sometimes see.",
        "- `filter_map(f)` — map and drop `None`s in one pass. `filter_map(|s| s.parse().ok())` is the idiom for \"parse what you can\".",
        "- `flat_map(f)` — map to an iterator, then flatten. `flatten()` on its own flattens nested iterables, and also drops `None`s from an iterator of `Option`.",
        "- `scan(init, f)` — like `fold`, but yields each intermediate value. Running totals.",
        "- `inspect(f)` — peek at each item without changing it. Excellent for debugging a chain.",
        "",
        "## Combining and slicing",
        "",
        "- `zip(other)` — pairs, stopping at the shorter one.",
        "- `enumerate()` — `(index, item)`.",
        "- `chain(other)` — one after the other.",
        "- `take(n)` / `skip(n)` / `take_while(p)` / `skip_while(p)` / `step_by(n)`.",
        "- `rev()` — needs a double-ended iterator.",
        "- `peekable()` — lets you look at `next` without consuming it; essential when writing parsers.",
        "",
        "## Collecting",
        "",
        "`collect()` is driven by the target type, and it is cleverer than it looks:",
        "",
        "- `Vec<T>`, `String`, `HashMap<K, V>` from pairs, `HashSet<T>`,",
        "- `Result<Vec<T>, E>` from an iterator of `Result` — short-circuits on the first error,",
        "- `(Vec<A>, Vec<B>)` from an iterator of pairs, via `unzip`.",
        "",
        "`partition(p)` splits into two collections; `group`-style work usually goes through `fold` with a `HashMap`.",
      ),
      code: `use std::collections::HashMap;

fn main() {
    let nums: Vec<i32> = (1..=10).collect();

    println!("map        {:?}", nums.iter().map(|n| n * n).collect::<Vec<i32>>());
    println!("filter     {:?}", nums.iter().filter(|n| **n % 3 == 0).collect::<Vec<&i32>>());
    println!("take/skip  {:?}", nums.iter().skip(2).take(3).collect::<Vec<&i32>>());
    println!("take_while {:?}", nums.iter().take_while(|n| **n < 5).collect::<Vec<&i32>>());
    println!("skip_while {:?}", nums.iter().skip_while(|n| **n < 8).collect::<Vec<&i32>>());
    println!("step_by    {:?}", nums.iter().step_by(3).collect::<Vec<&i32>>());
    println!("rev        {:?}", nums.iter().rev().take(3).collect::<Vec<&i32>>());

    // filter_map: parse what you can, silently drop the rest.
    let raw = ["1", "two", "3", "4x", "5"];
    let parsed: Vec<i32> = raw.iter().filter_map(|s| s.parse().ok()).collect();
    println!("filter_map {parsed:?}");

    // flat_map and flatten.
    let sentences = ["hello world", "rust is fast"];
    let words: Vec<&str> = sentences.iter().flat_map(|s| s.split(' ')).collect();
    println!("flat_map   {words:?}");
    let nested = vec![vec![1, 2], vec![3], vec![4, 5]];
    println!("flatten    {:?}", nested.into_iter().flatten().collect::<Vec<i32>>());
    let maybes = vec![Some(1), None, Some(3)];
    println!("drop Nones {:?}", maybes.into_iter().flatten().collect::<Vec<i32>>());

    // zip and enumerate.
    let names = ["ana", "bo", "cy"];
    let ages = [31, 24];
    println!("zip        {:?}", names.iter().zip(ages.iter()).collect::<Vec<_>>());
    for (i, name) in names.iter().enumerate() {
        print!("{i}={name} ");
    }
    println!();

    // scan: a running total, yielding every step.
    let running: Vec<i32> = nums
        .iter()
        .scan(0, |acc, n| {
            *acc += n;
            Some(*acc)
        })
        .collect();
    println!("running    {running:?}");

    // inspect: debugging a chain without breaking it.
    let total: i32 = nums
        .iter()
        .filter(|n| **n > 8)
        .inspect(|n| println!("  inspecting {n}"))
        .sum();
    println!("inspected total {total}");

    // peekable: look ahead without consuming.
    let mut chars = "a1b2".chars().peekable();
    while let Some(c) = chars.next() {
        if let Some(next) = chars.peek() {
            println!("  {c} is followed by {next}");
        }
    }

    // chunks and windows work on slices.
    println!("chunks     {:?}", nums.chunks(4).collect::<Vec<&[i32]>>());
    println!("windows    {:?}", nums.windows(9).collect::<Vec<&[i32]>>());

    // Collecting into different shapes.
    let as_string: String = "rust".chars().map(|c| c.to_ascii_uppercase()).collect();
    println!("to String  {as_string}");

    let map: HashMap<&str, usize> = names.iter().map(|n| (*n, n.len())).collect();
    let mut shown: Vec<_> = map.into_iter().collect();
    shown.sort();
    println!("to HashMap {shown:?}");

    let (evens, odds): (Vec<i32>, Vec<i32>) = nums.iter().partition(|n| **n % 2 == 0);
    println!("partition  {evens:?} / {odds:?}");

    let (letters, lengths): (Vec<&str>, Vec<usize>) =
        names.iter().map(|n| (*n, n.len())).unzip();
    println!("unzip      {letters:?} {lengths:?}");

    // Collecting into a Result short-circuits on the first error.
    let all: Result<Vec<i32>, _> = ["1", "2"].iter().map(|s| s.parse::<i32>()).collect();
    let some: Result<Vec<i32>, _> = ["1", "x"].iter().map(|s| s.parse::<i32>()).collect();
    println!("to Result  {all:?} / {}", some.is_err());

    // Grouping, the fold-with-a-map way.
    let people = ["ana", "arnold", "bo", "cy", "cyril"];
    let grouped = people.iter().fold(HashMap::<char, Vec<&str>>::new(), |mut acc, name| {
        acc.entry(name.chars().next().unwrap()).or_default().push(name);
        acc
    });
    let mut keys: Vec<&char> = grouped.keys().collect();
    keys.sort();
    for k in keys {
        println!("  {k}: {:?}", grouped[k]);
    }

    // max_by_key / min_by / sum with a key.
    println!("longest    {:?}", people.iter().max_by_key(|p| p.len()));
    println!("total chars{}", people.iter().map(|p| p.len()).sum::<usize>());
    println!("dedup-ish  {:?}", {
        let mut v = vec![3, 1, 3, 2, 1];
        v.sort_unstable();
        v.dedup();
        v
    });
}`,
      exercise: {
        prompt:
          "From `[\"3\", \"x\", \"9\", \"\", \"1\"]`, parse what you can with `filter_map`, sort descending, and print `top: [9, 3, 1]`.",
        expect: { contains: ["top: [9, 3, 1]"], sourceContains: ["filter_map"] },
        hint: "`let mut v: Vec<i32> = raw.iter().filter_map(|s| s.parse().ok()).collect(); v.sort_by(|a, b| b.cmp(a));`",
      },
    },

    {
      slug: "custom-iterator",
      title: "Implementing Iterator",
      summary:
        "Write `next()` once and inherit the whole adapter library.",
      tags: ["Iterator", "next", "IntoIterator", "Item"],
      body: md(
        "Implementing `Iterator` for your own type takes one method, and in return every adapter in the standard library starts working on it. This is the clearest demonstration of what default trait methods buy you.",
        "",
        "```rust",
        "struct Counter { n: u32 }",
        "",
        "impl Iterator for Counter {",
        "    type Item = u32;",
        "    fn next(&mut self) -> Option<u32> {",
        "        if self.n < 5 { self.n += 1; Some(self.n) } else { None }",
        "    }",
        "}",
        "",
        "counter.zip(other).map(|(a, b)| a * b).filter(|x| x % 3 == 0).sum::<u32>()",
        "```",
        "",
        "None of those adapters know anything about `Counter`. They only call `next`.",
        "",
        "## Rules to respect",
        "",
        "- Once you return `None`, keep returning `None` (the `FusedIterator` contract). Adapters assume it.",
        "- Implement `size_hint()` if you can state the length cheaply — `collect` uses it to preallocate.",
        "- `DoubleEndedIterator` (add `next_back`) unlocks `rev()`. `ExactSizeIterator` unlocks `len()`.",
        "",
        "## IntoIterator",
        "",
        "To make your *collection* work in `for x in collection`, implement `IntoIterator`. The convention is three impls: one for `T` (yielding owned items), one for `&T` (yielding `&Item`), one for `&mut T`. That is exactly what makes `for x in &v` and `for x in v` both work for `Vec`.",
      ),
      code: `/// A finite counter.
struct Counter {
    current: u32,
    limit: u32,
}

impl Counter {
    fn up_to(limit: u32) -> Self {
        Self { current: 0, limit }
    }
}

impl Iterator for Counter {
    type Item = u32;

    fn next(&mut self) -> Option<u32> {
        if self.current < self.limit {
            self.current += 1;
            Some(self.current)
        } else {
            None
        }
    }

    /// Lets collect() preallocate exactly the right capacity.
    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = (self.limit - self.current) as usize;
        (remaining, Some(remaining))
    }
}

/// The Fibonacci sequence, as an infinite iterator.
struct Fib {
    a: u64,
    b: u64,
}

impl Iterator for Fib {
    type Item = u64;
    fn next(&mut self) -> Option<u64> {
        let out = self.a;
        self.a = self.b;
        self.b = out + self.b;
        Some(out)
    }
}

/// Splitting text into sentences, yielding borrowed slices.
struct Sentences<'a> {
    rest: &'a str,
}

impl<'a> Iterator for Sentences<'a> {
    type Item = &'a str;
    fn next(&mut self) -> Option<&'a str> {
        if self.rest.is_empty() {
            return None;
        }
        match self.rest.find(['.', '!', '?']) {
            Some(i) => {
                let (head, tail) = self.rest.split_at(i + 1);
                self.rest = tail.trim_start();
                Some(head.trim())
            }
            None => {
                let all = self.rest;
                self.rest = "";
                Some(all.trim())
            }
        }
    }
}

/// A collection of our own, usable in a for loop three ways.
struct Stack<T> {
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self {
        Self { items: Vec::new() }
    }
    fn push(&mut self, item: T) -> &mut Self {
        self.items.push(item);
        self
    }
}

impl<T> IntoIterator for Stack<T> {
    type Item = T;
    type IntoIter = std::vec::IntoIter<T>;
    fn into_iter(self) -> Self::IntoIter {
        self.items.into_iter()
    }
}

impl<'a, T> IntoIterator for &'a Stack<T> {
    type Item = &'a T;
    type IntoIter = std::slice::Iter<'a, T>;
    fn into_iter(self) -> Self::IntoIter {
        self.items.iter()
    }
}

impl<'a, T> IntoIterator for &'a mut Stack<T> {
    type Item = &'a mut T;
    type IntoIter = std::slice::IterMut<'a, T>;
    fn into_iter(self) -> Self::IntoIter {
        self.items.iter_mut()
    }
}

fn main() {
    // One next() method, and the entire adapter library applies.
    println!("collected {:?}", Counter::up_to(5).collect::<Vec<u32>>());
    println!("sum       {}", Counter::up_to(10).sum::<u32>());
    println!(
        "zipped    {}",
        Counter::up_to(5)
            .zip(Counter::up_to(5).skip(1))
            .map(|(a, b)| a * b)
            .filter(|x| x % 3 == 0)
            .sum::<u32>()
    );
    println!("as string {}", Counter::up_to(4).map(|n| n.to_string()).collect::<Vec<_>>().join("+"));

    // An infinite iterator is fine as long as something bounds it.
    let fib = Fib { a: 0, b: 1 };
    println!("fib       {:?}", fib.take(10).collect::<Vec<u64>>());
    println!(
        "first fib over 1000: {:?}",
        Fib { a: 0, b: 1 }.find(|n| *n > 1000)
    );

    // Borrowed items, with a lifetime.
    let text = "Rust is fast. It is also safe! Really?";
    for s in (Sentences { rest: text }) {
        println!("  sentence: {s:?}");
    }

    // Our own collection, iterated three ways.
    let mut stack = Stack::new();
    stack.push(1).push(2).push(3);

    for x in &stack {
        print!("{x} ");
    }
    println!("(by reference)");

    for x in &mut stack {
        *x *= 10;
    }
    println!("after mutation: {:?}", (&stack).into_iter().collect::<Vec<&i32>>());

    let total: i32 = stack.into_iter().sum();
    println!("consumed, total {total}");
}`,
      exercise: {
        prompt:
          "Implement `Iterator` for `struct Countdown { n: u32 }` so it yields `n, n-1, ... 1` then stops. Collect `Countdown { n: 3 }` and print `[3, 2, 1]`.",
        expect: { contains: ["[3, 2, 1]"] },
        hint: "In `next`: if `self.n == 0 { None } else { self.n -= 1; Some(self.n + 1) }`.",
      },
    },

    {
      slug: "box-and-recursion",
      title: "Box and recursive types",
      summary:
        "The simplest smart pointer, and the only way to define a type that contains itself.",
      tags: ["Box", "heap", "recursive", "dyn"],
      body: md(
        "`Box<T>` puts a value on the heap and keeps a pointer to it on the stack. It owns what it points at and frees it on drop. No reference counting, no runtime overhead beyond the indirection.",
        "",
        "## Three reasons to use one",
        "",
        "**1. Recursive types.** This does not compile:",
        "",
        "```rust",
        "enum List { Cons(i32, List), Nil }   // infinite size",
        "```",
        "",
        "To lay out `List` the compiler needs its size, which includes a `List`, which includes a `List`... A `Box` breaks the cycle because a pointer has a known size:",
        "",
        "```rust",
        "enum List { Cons(i32, Box<List>), Nil }   // fine",
        "```",
        "",
        "Trees, linked lists and expression ASTs all need this.",
        "",
        "**2. Large values you want to move cheaply.** Moving a `Box` copies one pointer, not the whole struct.",
        "",
        "**3. Trait objects.** `Box<dyn Trait>` is how you own a value whose concrete type is decided at runtime.",
        "",
        "## Using one",
        "",
        "`Box<T>` implements `Deref<Target = T>`, so you use it almost exactly like a `T` — methods auto-deref, and `*b` gets the value. `*b` on an owned box also *moves* the value out.",
        "",
        "> `Box` is the right default when you just need heap allocation with single ownership. Reach for `Rc` only when you genuinely need several owners — the next lesson.",
      ),
      code: `use std::fmt;

/// A cons list: impossible without the Box.
#[derive(Debug)]
enum List {
    Cons(i32, Box<List>),
    Nil,
}

use List::{Cons, Nil};

impl List {
    fn sum(&self) -> i32 {
        match self {
            Cons(head, tail) => head + tail.sum(),
            Nil => 0,
        }
    }
    fn len(&self) -> usize {
        match self {
            Cons(_, tail) => 1 + tail.len(),
            Nil => 0,
        }
    }
}

/// A binary search tree: two recursive children, each optional.
#[derive(Debug, Default)]
struct Tree {
    root: Option<Box<Node>>,
}

#[derive(Debug)]
struct Node {
    value: i32,
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}

impl Tree {
    fn insert(&mut self, value: i32) {
        Self::insert_at(&mut self.root, value);
    }

    fn insert_at(slot: &mut Option<Box<Node>>, value: i32) {
        match slot {
            None => {
                *slot = Some(Box::new(Node { value, left: None, right: None }));
            }
            Some(node) => {
                if value < node.value {
                    Self::insert_at(&mut node.left, value);
                } else if value > node.value {
                    Self::insert_at(&mut node.right, value);
                }
            }
        }
    }

    fn contains(&self, value: i32) -> bool {
        let mut cursor = &self.root;
        while let Some(node) = cursor {
            if value == node.value {
                return true;
            }
            cursor = if value < node.value { &node.left } else { &node.right };
        }
        false
    }

    /// In-order traversal gives the values back sorted.
    fn in_order(&self) -> Vec<i32> {
        let mut out = Vec::new();
        Self::walk(&self.root, &mut out);
        out
    }

    fn walk(slot: &Option<Box<Node>>, out: &mut Vec<i32>) {
        if let Some(node) = slot {
            Self::walk(&node.left, out);
            out.push(node.value);
            Self::walk(&node.right, out);
        }
    }
}

/// An expression tree — the classic use for Box.
enum Expr {
    Num(f64),
    Add(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
    Neg(Box<Expr>),
}

impl Expr {
    fn eval(&self) -> f64 {
        match self {
            Expr::Num(n) => *n,
            Expr::Add(a, b) => a.eval() + b.eval(),
            Expr::Mul(a, b) => a.eval() * b.eval(),
            Expr::Neg(a) => -a.eval(),
        }
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Expr::Num(n) => write!(f, "{n}"),
            Expr::Add(a, b) => write!(f, "({a} + {b})"),
            Expr::Mul(a, b) => write!(f, "({a} * {b})"),
            Expr::Neg(a) => write!(f, "-{a}"),
        }
    }
}

fn main() {
    // A Box is just heap storage with single ownership.
    let boxed = Box::new(5);
    println!("boxed {boxed}, deref {}", *boxed + 1);
    println!("a Box is {} bytes regardless of T", size_of::<Box<[u8; 1024]>>());

    // The cons list.
    let list = Cons(1, Box::new(Cons(2, Box::new(Cons(3, Box::new(Nil))))));
    println!("list sum {} len {}", list.sum(), list.len());

    // A search tree built from boxed nodes.
    let mut tree = Tree::default();
    for v in [8, 3, 10, 1, 6, 14, 4] {
        tree.insert(v);
    }
    println!("in order {:?}", tree.in_order());
    println!("contains 6?  {}", tree.contains(6));
    println!("contains 99? {}", tree.contains(99));

    // An expression tree, printed and evaluated.
    let expr = Expr::Add(
        Box::new(Expr::Mul(Box::new(Expr::Num(3.0)), Box::new(Expr::Num(4.0)))),
        Box::new(Expr::Neg(Box::new(Expr::Num(2.0)))),
    );
    println!("{expr} = {}", expr.eval());

    // Moving a Box moves one pointer, not the payload.
    let big = Box::new([0u8; 1024]);
    let moved = big;
    println!("moved a 1KB array by copying {} bytes", size_of_val(&moved));
}`,
      exercise: {
        prompt:
          "Define `enum Chain { Link(i32, Box<Chain>), End }` and build the chain 1 → 2 → End, then print its total with a recursive `sum` method so the output contains `chain sum: 3`.",
        expect: { contains: ["chain sum: 3"], sourceContains: ["Box"] },
        hint: "`Chain::Link(1, Box::new(Chain::Link(2, Box::new(Chain::End))))`, and `match self { Link(v, next) => v + next.sum(), End => 0 }`.",
      },
    },

    {
      slug: "rc-and-refcell",
      title: "Rc and RefCell",
      summary:
        "Shared ownership, and moving the borrow check to runtime when the compiler cannot see your invariant.",
      tags: ["Rc", "RefCell", "interior mutability", "Weak"],
      body: md(
        "Sometimes one owner is not enough — a graph node with several parents, a cache shared by two structures. `Rc<T>` (*reference counted*) allows it:",
        "",
        "```rust",
        "let a = Rc::new(vec![1, 2]);",
        "let b = Rc::clone(&a);     // cheap: bumps the count, no deep copy",
        "println!(\"{}\", Rc::strong_count(&a)); // 2",
        "```",
        "",
        "The value is dropped when the last `Rc` goes. `Rc::clone` is conventionally written in full rather than `a.clone()`, so readers can see it is a counter bump, not a deep copy.",
        "",
        "`Rc` is **single-threaded only**; the multi-threaded equivalent is `Arc` (module 8). And an `Rc<T>` only hands out shared references, so its contents are immutable.",
        "",
        "## Interior mutability",
        "",
        "`RefCell<T>` lets you mutate through a shared reference, by moving the borrow check from compile time to **runtime**:",
        "",
        "- `borrow()` gives a `Ref<T>`, `borrow_mut()` gives a `RefMut<T>`.",
        "- The same rule applies — many readers or one writer — but violating it **panics** instead of failing to compile.",
        "",
        "`Rc<RefCell<T>>` is therefore the standard combination for shared mutable state in a single thread.",
        "",
        "## Cycles leak",
        "",
        "Two `Rc`s pointing at each other never reach a count of zero, so the memory is never freed. Rust prevents dangling pointers, not leaks. The fix is `Weak<T>`: a non-owning reference, created with `Rc::downgrade`, which you `upgrade()` back to an `Option<Rc<T>>`. Parent pointers in a tree should be `Weak`.",
        "",
        "> If you find yourself reaching for `Rc<RefCell<T>>` everywhere, it is worth asking whether the design could pass `&mut` down instead. It often can, and it is faster and checked at compile time.",
      ),
      code: `use std::cell::RefCell;
use std::rc::{Rc, Weak};

/// A shared list used by several owners.
#[derive(Debug)]
struct Document {
    title: String,
    tags: Rc<Vec<String>>,
}

/// Shared mutable state: Rc for sharing, RefCell for mutation.
#[derive(Debug)]
struct Counter {
    hits: RefCell<u32>,
}

/// A tree where children own parents weakly, to avoid a leak.
#[derive(Debug)]
struct TreeNode {
    value: i32,
    parent: RefCell<Weak<TreeNode>>,
    children: RefCell<Vec<Rc<TreeNode>>>,
}

fn main() {
    // --- Rc: several owners of one allocation ---
    let tags = Rc::new(vec!["rust".to_string(), "memory".to_string()]);
    println!("count after creation: {}", Rc::strong_count(&tags));

    let d1 = Document { title: "Ownership".to_string(), tags: Rc::clone(&tags) };
    let d2 = Document { title: "Borrowing".to_string(), tags: Rc::clone(&tags) };
    println!("count with two docs:  {}", Rc::strong_count(&tags));
    println!("{} and {} share {:?}", d1.title, d2.title, d1.tags);
    println!("same allocation? {}", Rc::ptr_eq(&d1.tags, &d2.tags));

    {
        let _temp = Rc::clone(&tags);
        println!("count inside block:   {}", Rc::strong_count(&tags));
    }
    println!("count after block:    {}", Rc::strong_count(&tags));

    // --- RefCell: mutate through a shared reference ---
    let counter = Counter { hits: RefCell::new(0) };
    let shared = &counter; // only a shared reference...
    *shared.hits.borrow_mut() += 1; // ...yet we can still mutate
    *shared.hits.borrow_mut() += 1;
    println!("hits: {}", counter.hits.borrow());

    // The borrow rules still hold — they are just checked at runtime.
    let cell = RefCell::new(vec![1, 2, 3]);
    {
        let r1 = cell.borrow();
        let r2 = cell.borrow(); // two readers: fine
        println!("two shared borrows: {} {}", r1.len(), r2.len());
    }
    cell.borrow_mut().push(4);
    println!("after push: {:?}", cell.borrow());

    // Breaking the rule panics rather than failing to compile.
    let outcome = std::panic::catch_unwind(|| {
        let c = RefCell::new(1);
        let _first = c.borrow_mut();
        let _second = c.borrow_mut(); // already mutably borrowed
    });
    println!("double borrow_mut panicked? {}", outcome.is_err());

    // try_borrow_mut checks instead of panicking.
    let safe = RefCell::new(1);
    let _held = safe.borrow_mut();
    println!("try_borrow_mut while held: {:?}", safe.try_borrow_mut().is_err());
    drop(_held);
    println!("try_borrow_mut once free:  {:?}", safe.try_borrow_mut().is_ok());

    // --- Rc<RefCell<T>>: shared AND mutable ---
    let ledger = Rc::new(RefCell::new(Vec::<String>::new()));
    let writer_a = Rc::clone(&ledger);
    let writer_b = Rc::clone(&ledger);
    writer_a.borrow_mut().push("a wrote".to_string());
    writer_b.borrow_mut().push("b wrote".to_string());
    println!("ledger: {:?} ({} owners)", ledger.borrow(), Rc::strong_count(&ledger));

    // --- Weak: parent pointers that do not keep the parent alive ---
    let leaf = Rc::new(TreeNode {
        value: 3,
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(vec![]),
    });
    println!("leaf parent before: {:?}", leaf.parent.borrow().upgrade().map(|p| p.value));

    let branch = Rc::new(TreeNode {
        value: 5,
        parent: RefCell::new(Weak::new()),
        children: RefCell::new(vec![Rc::clone(&leaf)]),
    });
    *leaf.parent.borrow_mut() = Rc::downgrade(&branch);

    println!("leaf parent after:  {:?}", leaf.parent.borrow().upgrade().map(|p| p.value));
    println!(
        "branch strong={} weak={}",
        Rc::strong_count(&branch),
        Rc::weak_count(&branch)
    );
    println!(
        "children of branch: {:?}",
        branch.children.borrow().iter().map(|c| c.value).collect::<Vec<i32>>()
    );
}`,
      exercise: {
        prompt:
          "Create an `Rc<RefCell<i32>>` starting at 0, clone it twice, increment through each clone, and print `shared: 2`.",
        expect: { contains: ["shared: 2"], sourceContains: ["RefCell"] },
        hint: "`let n = Rc::new(RefCell::new(0)); let a = Rc::clone(&n); *a.borrow_mut() += 1;` and so on, then print `n.borrow()`.",
      },
    },

    {
      slug: "deref-and-drop",
      title: "Deref and Drop",
      summary:
        "The two traits that make smart pointers feel transparent and clean up after themselves.",
      tags: ["Deref", "Drop", "RAII", "coercion"],
      body: md(
        "These are the traits that turn a struct into a *smart pointer*.",
        "",
        "## Deref",
        "",
        "Implementing `Deref` makes `*value` work, and — more importantly — enables **deref coercion**: the compiler will automatically convert `&MyBox<String>` to `&String` to `&str` when looking for a matching parameter or method.",
        "",
        "That single rule explains a lot of apparent magic:",
        "",
        "- `&String` works where `&str` is wanted,",
        "- `&Vec<T>` works where `&[T]` is wanted,",
        "- `box.method()` finds methods on the contents.",
        "",
        "`DerefMut` does the same for mutable references. Deref coercion is resolved at compile time and costs nothing.",
        "",
        "> `Deref` is for smart pointers, not for inheritance. Implementing it to \"inherit\" another type's methods confuses readers and tooling.",
        "",
        "## Drop",
        "",
        "`drop(&mut self)` runs automatically when a value goes out of scope — this is RAII. It is how `Box` frees memory, `File` closes its handle, and `MutexGuard` releases its lock. You never call it by hand; the compiler inserts the call, exactly once, on every exit path including a panic unwind.",
        "",
        "Details worth knowing:",
        "",
        "- Values drop in **reverse** declaration order; a struct's fields drop after its own `drop` body.",
        "- To drop something early, call `std::mem::drop(value)` — which just takes it by value and lets it fall out of scope.",
        "- A type implementing `Drop` can never be `Copy`.",
      ),
      code: `use std::ops::{Deref, DerefMut};

/// A minimal Box, to show what Deref actually provides.
struct MyBox<T>(T);

impl<T> MyBox<T> {
    fn new(x: T) -> MyBox<T> {
        MyBox(x)
    }
}

impl<T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

impl<T> DerefMut for MyBox<T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

/// A guard that announces its own cleanup — the shape of every RAII type.
struct Guard {
    name: String,
}

impl Guard {
    fn new(name: &str) -> Self {
        println!("  acquiring {name}");
        Guard { name: name.to_string() }
    }
}

impl Drop for Guard {
    fn drop(&mut self) {
        println!("  releasing {}", self.name);
    }
}

/// Drop order: the struct's own body first, then its fields.
struct Outer {
    _inner: Guard,
}

impl Drop for Outer {
    fn drop(&mut self) {
        println!("  Outer::drop runs before its fields");
    }
}

/// A timer that reports elapsed scope on the way out.
struct Section(&'static str);

impl Drop for Section {
    fn drop(&mut self) {
        println!("--- end of {} ---", self.0);
    }
}

fn hello(name: &str) {
    println!("  hello, {name}");
}

fn main() {
    {
        let _s = Section("deref");

        let b = MyBox::new(5);
        println!("  *b = {}", *b);

        // Deref coercion: &MyBox<String> -> &String -> &str, automatically.
        let name = MyBox::new(String::from("ada"));
        hello(&name);
        println!("  len through two derefs: {}", name.len());

        // DerefMut lets us mutate the contents.
        let mut counter = MyBox::new(0);
        *counter += 10;
        println!("  counter = {}", *counter);

        // The same coercion the standard library relies on.
        let owned = String::from("a string");
        hello(&owned); // &String -> &str
        let v = vec![1, 2, 3];
        println!("  slice sum {}", sum_slice(&v)); // &Vec<i32> -> &[i32]
    }

    {
        let _s = Section("drop order");
        // Dropped in reverse order of declaration.
        let _first = Guard::new("first");
        let _second = Guard::new("second");
        println!("  (end of block)");
    }

    {
        let _s = Section("nested drop");
        let _o = Outer { _inner: Guard::new("inner") };
        println!("  (end of block)");
    }

    {
        let _s = Section("early drop");
        let g = Guard::new("short-lived");
        println!("  doing work");
        drop(g); // release it now rather than at the brace
        println!("  work done, lock already released");
    }

    {
        let _s = Section("drop on panic");
        let outcome = std::panic::catch_unwind(|| {
            let _g = Guard::new("held during a panic");
            panic!("something went wrong");
        });
        println!("  panicked: {} — but the guard still released", outcome.is_err());
    }

    println!("main is done");
}

fn sum_slice(xs: &[i32]) -> i32 {
    xs.iter().sum()
}`,
      exercise: {
        prompt:
          "Give a struct `Temp` a `Drop` impl that prints `cleaning up`, create one inside a block, and confirm the message appears when the block ends.",
        expect: { contains: ["cleaning up"], sourceContains: ["impl Drop"] },
        hint: "`impl Drop for Temp { fn drop(&mut self) { println!(\"cleaning up\"); } }` then `{ let _t = Temp; }`",
      },
    },
  ],
};
