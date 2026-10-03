import { md } from "./_util.js";

export default {
  id: "collections-errors",
  n: 5,
  title: "Collections & error handling",
  summary:
    "Vec, HashMap and UTF-8 strings, then Result, the `?` operator and your own error types.",
  lessons: [
    {
      slug: "vectors",
      title: "Vec",
      summary: "The growable array you will use more than any other collection.",
      tags: ["Vec", "push", "capacity", "retain"],
      body: md(
        "`Vec<T>` is a heap-allocated, growable list of `T`. Where an array `[T; N]` has its length in its type, a `Vec` decides at runtime.",
        "",
        "```rust",
        "let mut v: Vec<i32> = Vec::new();",
        "let v = vec![1, 2, 3];        // the macro",
        "let v = vec![0; 10];          // ten zeros",
        "```",
        "",
        "Internally it is three words: a pointer, a length and a **capacity**. Pushing past the capacity reallocates — typically doubling — so pushing `n` items costs amortised O(1) each. `Vec::with_capacity(n)` avoids the intermediate reallocations when you know the size up front.",
        "",
        "## Reading elements",
        "",
        "`v[i]` panics if out of range; `v.get(i)` returns `Option<&T>`. Same trade-off as slices.",
        "",
        "## The borrow rule bites here",
        "",
        "```rust",
        "let first = &v[0];",
        "v.push(4);        // error: cannot borrow v as mutable",
        "println!(\"{first}\");",
        "```",
        "",
        "That is not pedantry. `push` may reallocate and move every element to a new address, which would leave `first` pointing at freed memory. Other languages let you write this and call the result a dangling iterator; Rust rejects it at compile time.",
        "",
        "## Worth knowing",
        "",
        "`push` `pop` `insert` `remove` `len` `is_empty` `clear` `contains` `sort` `sort_by` `dedup` `retain` `extend` `truncate` `swap_remove` `drain` `iter` `iter_mut` `into_iter` `first` `last` `windows` `chunks` `concat`.",
        "",
        "`retain` is the one people miss: it filters in place without allocating a new `Vec`.",
      ),
      code: `fn main() {
    // Three ways to build one.
    let mut v: Vec<i32> = Vec::new();
    v.push(1);
    v.push(2);
    let literal = vec![10, 20, 30];
    let filled = vec![0u8; 5];
    println!("{v:?} {literal:?} {filled:?}");

    // Capacity grows geometrically; reserve up front when you can.
    let mut growing = Vec::with_capacity(4);
    for i in 0..10 {
        growing.push(i);
    }
    println!("len {} capacity {}", growing.len(), growing.capacity());

    // Indexing vs get.
    println!("literal[1] = {}", literal[1]);
    println!("get(9)     = {:?}", literal.get(9));

    // Adding and removing.
    let mut nums = vec![5, 3, 8, 1, 9, 3];
    nums.insert(0, 100);
    let popped = nums.pop();
    let removed = nums.remove(0);
    println!("{nums:?} popped {popped:?} removed {removed}");

    // swap_remove is O(1) but does not preserve order.
    let mut q = vec!['a', 'b', 'c', 'd'];
    let gone = q.swap_remove(0);
    println!("removed {gone}, left {q:?}");

    // Sorting, deduping, reversing.
    nums.sort();
    println!("sorted  {nums:?}");
    nums.dedup();
    println!("deduped {nums:?}");
    nums.reverse();
    println!("reversed{nums:?}");
    nums.sort_by(|a, b| b.cmp(a));
    println!("desc    {nums:?}");

    // Sorting by a key, including floats (which are not Ord).
    let mut words = vec!["pear", "fig", "banana"];
    words.sort_by_key(|w| w.len());
    println!("by length {words:?}");
    let mut temps = vec![3.5, -1.0, 2.25];
    temps.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("floats {temps:?}");

    // retain filters in place.
    let mut mixed = vec![1, 2, 3, 4, 5, 6, 7, 8];
    mixed.retain(|n| n % 2 == 0);
    println!("evens only {mixed:?}");

    // extend, truncate, drain.
    mixed.extend([10, 12]);
    println!("extended {mixed:?}");
    let drained: Vec<i32> = mixed.drain(..2).collect();
    println!("drained {drained:?} leaving {mixed:?}");
    mixed.truncate(2);
    println!("truncated {mixed:?}");

    // windows and chunks.
    let series = [1, 4, 9, 16, 25];
    println!("windows: {:?}", series.windows(2).collect::<Vec<_>>());
    println!("chunks:  {:?}", series.chunks(2).collect::<Vec<_>>());
    let diffs: Vec<i32> = series.windows(2).map(|w| w[1] - w[0]).collect();
    println!("diffs {diffs:?}");

    // A Vec of Strings owns every String in it.
    let mut names = vec![String::from("ana")];
    names.push("bo".to_string());
    println!("{names:?} total chars {}", names.iter().map(|n| n.len()).sum::<usize>());

    // Holding a borrow across a push is rejected. Uncomment to see it:
    // let first = &series[0];
    // let mut owned = series.to_vec();
    // owned.push(36);
    // println!("{first}");
}`,
      exercise: {
        prompt:
          "Build a `Vec<i32>` of the squares of 1 through 6, keep only the ones above 10, and print `kept: [16, 25, 36]`.",
        expect: { contains: ["kept: [16, 25, 36]"] },
        hint: "`let mut v: Vec<i32> = (1..=6).map(|n| n * n).collect(); v.retain(|n| *n > 10);`",
      },
    },

    {
      slug: "hashmaps",
      title: "HashMap and friends",
      summary: "Key-value storage, the entry API, and when to use the other maps.",
      tags: ["HashMap", "entry", "BTreeMap", "HashSet"],
      body: md(
        "`HashMap<K, V>` stores values under keys. It is not in the prelude, so you import it:",
        "",
        "```rust",
        "use std::collections::HashMap;",
        "let mut scores = HashMap::new();",
        "scores.insert(String::from(\"blue\"), 10);",
        "```",
        "",
        "Keys must implement `Eq` and `Hash` — true of all the primitives, `String`, and any struct you `#[derive(PartialEq, Eq, Hash)]`.",
        "",
        "## Reading",
        "",
        "`get` returns `Option<&V>`, since the key may be absent. `get(&k).copied().unwrap_or(0)` is the idiomatic \"value or default\".",
        "",
        "## The entry API",
        "",
        "This is the part worth learning properly. `entry(key)` gives you a handle to a slot, present or not:",
        "",
        "```rust",
        "*counts.entry(word).or_insert(0) += 1;              // count occurrences",
        "map.entry(k).or_insert_with(Vec::new).push(v);      // group into buckets",
        "map.entry(k).and_modify(|v| *v += 1).or_insert(1);  // update or create",
        "```",
        "",
        "One lookup instead of two, and no `if contains_key` dance.",
        "",
        "## Choosing a map or set",
        "",
        "| Type | Ordering | Use when |",
        "|---|---|---|",
        "| `HashMap` | none (randomised) | the default |",
        "| `BTreeMap` | sorted by key | you need order, or range queries |",
        "| `HashSet` | none | membership only |",
        "| `BTreeSet` | sorted | sorted membership |",
        "",
        "Iteration order of a `HashMap` is deliberately unspecified and varies between runs — the hasher is randomly seeded to resist denial-of-service attacks. If you need a stable order, sort the keys or use a `BTreeMap`.",
      ),
      code: `use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    // Insert and read.
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert("blue".to_string(), 10);
    scores.insert("red".to_string(), 50);
    scores.insert("blue".to_string(), 25); // overwrites

    println!("blue   {:?}", scores.get("blue"));
    println!("green  {:?}", scores.get("green"));
    println!("or 0:  {}", scores.get("green").copied().unwrap_or(0));
    println!("has red? {}", scores.contains_key("red"));

    // Iteration order is unspecified, so sort when you need determinism.
    let mut pairs: Vec<(&String, &i32)> = scores.iter().collect();
    pairs.sort();
    println!("sorted pairs {pairs:?}");

    // The entry API: count word frequencies in one pass.
    let text = "the quick brown fox jumps over the lazy dog the end";
    let mut counts: HashMap<&str, i32> = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    let mut by_count: Vec<(&&str, &i32)> = counts.iter().collect();
    by_count.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));
    println!("top three: {:?}", &by_count[..3]);

    // or_insert_with to group into buckets.
    let people = [("eng", "ana"), ("ops", "bo"), ("eng", "cy")];
    let mut teams: HashMap<&str, Vec<&str>> = HashMap::new();
    for (team, person) in people {
        teams.entry(team).or_default().push(person);
    }
    let mut team_names: Vec<&&str> = teams.keys().collect();
    team_names.sort();
    for name in team_names {
        println!("{name}: {:?}", teams[*name]);
    }

    // and_modify for update-or-create.
    let mut visits: HashMap<&str, u32> = HashMap::new();
    for page in ["/", "/about", "/"] {
        visits.entry(page).and_modify(|v| *v += 1).or_insert(1);
    }
    println!("home visits {:?}", visits.get("/"));

    // Mutating a value in place.
    if let Some(v) = scores.get_mut("red") {
        *v += 5;
    }
    println!("red now {:?}", scores.get("red"));

    // Removing.
    let taken = scores.remove("blue");
    println!("removed {taken:?}, {} left", scores.len());

    // BTreeMap keeps keys sorted, and supports ranges.
    let mut ages: BTreeMap<&str, u32> = BTreeMap::new();
    ages.insert("cy", 45);
    ages.insert("ana", 31);
    ages.insert("bo", 24);
    println!("btree in order {ages:?}");
    println!("first {:?} last {:?}", ages.first_key_value(), ages.last_key_value());

    // Sets: membership and set algebra.
    let a: HashSet<i32> = [1, 2, 3, 4].into_iter().collect();
    let b: HashSet<i32> = [3, 4, 5].into_iter().collect();
    let mut shared: Vec<&i32> = a.intersection(&b).collect();
    shared.sort();
    println!("intersection {shared:?}");
    let mut only_a: Vec<&i32> = a.difference(&b).collect();
    only_a.sort();
    println!("difference {only_a:?}");
    println!("contains 3? {}", a.contains(&3));

    // Deduplicating with a set.
    let dupes = vec![1, 2, 2, 3, 1];
    let unique: HashSet<i32> = dupes.iter().copied().collect();
    println!("{} unique values", unique.len());

    // Building a map straight from an iterator of pairs.
    let built: HashMap<&str, usize> =
        ["one", "three", "five"].iter().map(|w| (*w, w.len())).collect();
    let mut shown: Vec<(&&str, &usize)> = built.iter().collect();
    shown.sort();
    println!("{shown:?}");
}`,
      exercise: {
        prompt:
          "Count how many times each character appears in `\"hello\"` using a `HashMap<char, i32>` with the entry API, then print the count for `'l'` as `l: 2`.",
        expect: { contains: ["l: 2"] },
        hint: "`for c in \"hello\".chars() { *counts.entry(c).or_insert(0) += 1; }` then print `counts[&'l']`.",
      },
    },

    {
      slug: "strings-utf8",
      title: "Strings and UTF-8",
      summary:
        "Why you cannot index a string, and how to iterate characters, bytes and graphemes.",
      tags: ["UTF-8", "chars", "bytes", "char_indices"],
      body: md(
        "Rust strings are guaranteed valid UTF-8. That guarantee is why `s[0]` does not compile.",
        "",
        "Consider `\"héllo\"`. It is 6 **bytes** but 5 **characters**, because `é` takes two bytes. So what should `s[0]` return? A byte would be half a character. A char would mean the index is not an offset, making indexing O(n) and silently expensive. Rust refuses the question rather than pick a misleading answer.",
        "",
        "## Three levels to iterate",
        "",
        "- `.bytes()` — `u8` per byte. What the memory actually holds.",
        "- `.chars()` — `char` per Unicode scalar value. Usually what you mean.",
        "- `.char_indices()` — `(byte_offset, char)` pairs, when you need both.",
        "",
        "There is a fourth level, the **grapheme cluster** — what a human calls a character, e.g. an emoji with a skin-tone modifier, or `e` plus a combining accent. The standard library leaves that to the `unicode-segmentation` crate, because the rules are large and change with the Unicode spec.",
        "",
        "## Slicing is by byte offset",
        "",
        "`&s[0..2]` works, but **panics** if an offset falls inside a character. When you do not know the boundaries, use `.chars().take(n)`, or `char_indices` to find a safe cut point.",
        "",
        "## Building strings",
        "",
        "`push_str`, `push`, `+`, `format!`, `.collect()` from an iterator of `char` or `&str`, `concat()`, `join()`. For a hot loop, `String::with_capacity` then `push_str` avoids reallocation.",
        "",
        "> `s.len()` is bytes, always. For a character count use `s.chars().count()` — and notice it is a `count()`, i.e. O(n), which is itself a useful hint about what is going on.",
      ),
      code: `fn main() {
    let s = String::from("héllo wörld");

    // len is bytes; counting chars is a linear scan.
    println!("{s}");
    println!("bytes {} chars {}", s.len(), s.chars().count());

    // Three levels of iteration.
    let word = "héllo";
    println!("bytes:  {:?}", word.bytes().collect::<Vec<u8>>());
    println!("chars:  {:?}", word.chars().collect::<Vec<char>>());
    println!("indices:{:?}", word.char_indices().collect::<Vec<(usize, char)>>());

    // Slicing is by byte offset and must land on a character boundary.
    println!("first char as a slice: {:?}", &word[0..1]);
    // println!("{}", &word[1..2]); // <-- uncomment: panics, splits 'é' in half

    // Safe prefixes, regardless of encoding.
    let prefix: String = word.chars().take(3).collect();
    println!("first 3 chars: {prefix}");

    // Reversing by char (not by byte, which would corrupt the UTF-8).
    let reversed: String = word.chars().rev().collect();
    println!("reversed: {reversed}");

    // Case conversion is Unicode-aware and can change length.
    println!("upper: {}", "straße".to_uppercase());
    println!("lower: {}", "ÅNGSTRÖM".to_lowercase());

    // Searching and splitting.
    let csv = "name, age ,city";
    let fields: Vec<&str> = csv.split(',').map(|f| f.trim()).collect();
    println!("{fields:?}");
    println!("find 'age' at byte {:?}", csv.find("age"));
    println!("lines: {:?}", "a\\nb\\nc".lines().collect::<Vec<&str>>());
    println!("once: {:?}", "key=value=more".split_once('='));

    // Char classification.
    for ch in ['R', '7', ' ', 'é'] {
        println!(
            "{ch:?} alpha={} numeric={} whitespace={} ascii={}",
            ch.is_alphabetic(),
            ch.is_numeric(),
            ch.is_whitespace(),
            ch.is_ascii()
        );
    }

    // Building efficiently.
    let mut out = String::with_capacity(32);
    for i in 1..=5 {
        out.push_str(&i.to_string());
        out.push('-');
    }
    out.pop(); // drop the trailing dash
    println!("built: {out}");

    // Collecting from chars, filtering as you go.
    let letters_only: String = s.chars().filter(|c| c.is_alphabetic()).collect();
    println!("letters only: {letters_only}");

    // A palindrome check that respects case and punctuation.
    for candidate in ["A man, a plan, a canal: Panama", "rust"] {
        println!("{candidate:?} palindrome? {}", is_palindrome(candidate));
    }
}

fn is_palindrome(s: &str) -> bool {
    let cleaned: Vec<char> = s
        .chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    cleaned.iter().eq(cleaned.iter().rev())
}`,
      exercise: {
        prompt:
          "Count the vowels in `\"programming in rust\"` and print `vowels: 5`.",
        expect: { contains: ["vowels: 5"] },
        hint: "`let n = s.chars().filter(|c| \"aeiou\".contains(*c)).count();`",
      },
    },

    {
      slug: "result",
      title: "Result — errors as values",
      summary:
        "Recoverable failure in the type system, and when panicking is the right answer instead.",
      tags: ["Result", "Ok", "Err", "panic!"],
      body: md(
        "Rust splits failure into two categories, and keeps them apart.",
        "",
        "**Unrecoverable:** a bug. The invariant you relied on is broken, and continuing would be worse than stopping. `panic!` unwinds the stack and aborts the thread. Index out of bounds, `unwrap` on `None`, integer division by zero, and failed assertions all panic.",
        "",
        "**Recoverable:** an expected outcome. The file might not exist; the input might not parse; the network might be down. These are not bugs — they are cases, and they belong in the return type:",
        "",
        "```rust",
        "enum Result<T, E> { Ok(T), Err(E) }",
        "```",
        "",
        "`Result` is `#[must_use]`, so ignoring one produces a warning. You cannot accidentally overlook a failure the way you can with an unchecked return code.",
        "",
        "## Handling a Result",
        "",
        "- `match` — full control, both branches explicit.",
        "- `if let Ok(v) = ...` — when you only care about success.",
        "- `unwrap_or`, `unwrap_or_else`, `unwrap_or_default` — supply a fallback.",
        "- `map`, `map_err`, `and_then` — transform the success or the error without unwrapping.",
        "- `ok()` — discard the error, giving `Option<T>`.",
        "- `expect(\"msg\")` — panic with context. Use it when `Err` would mean a bug, and write a message that says *why* you expected success.",
        "- `?` — propagate to the caller. Next lesson.",
        "",
        "## Which to reach for",
        "",
        "In a library, return `Result` and let the caller decide. In application code at the top level, panicking on a genuinely impossible condition is fine. `unwrap()` in examples and tests is fine. `unwrap()` in a long-lived service is how you get a 3 a.m. page.",
      ),
      code: `use std::num::ParseIntError;

fn main() {
    // A Result in the wild: parsing.
    let good: Result<i32, ParseIntError> = "42".parse();
    let bad: Result<i32, ParseIntError> = "forty".parse();
    println!("{good:?}");
    println!("{bad:?}");

    // Full handling.
    match "17".parse::<i32>() {
        Ok(n) => println!("parsed {n}"),
        Err(e) => println!("failed: {e}"),
    }

    // Fallbacks.
    println!("or zero:    {}", bad.clone().unwrap_or(0));
    println!("or computed:{}", "x".parse::<i32>().unwrap_or_else(|_| -1));
    println!("or default: {}", "x".parse::<i32>().unwrap_or_default());

    // Inspecting.
    println!("is_ok {} is_err {}", good.is_ok(), bad.is_err());
    println!("as Option: {:?}", bad.clone().ok());

    // Transforming either side.
    println!("mapped:    {:?}", good.clone().map(|n| n * 2));
    println!("map_err:   {:?}", bad.clone().map_err(|e| format!("bad input: {e}")));
    // and_then needs matching error types, so normalise the error first.
    let as_string_err = good.clone().map_err(|e| e.to_string());
    println!("and_then:  {:?}", as_string_err.and_then(checked_half));
    println!("and_then:  {:?}", checked_half(7));

    // Our own fallible function.
    for input in ["10", "0", "abc"] {
        match divide_text(100, input) {
            Ok(v) => println!("100 / {input} = {v}"),
            Err(e) => println!("100 / {input} failed: {e}"),
        }
    }

    // Collecting into a Result: the first Err wins and short-circuits.
    let all_good: Result<Vec<i32>, _> = ["1", "2", "3"].iter().map(|s| s.parse::<i32>()).collect();
    let one_bad: Result<Vec<i32>, _> = ["1", "x", "3"].iter().map(|s| s.parse::<i32>()).collect();
    println!("all good {all_good:?}");
    println!("one bad  {one_bad:?}");

    // Or keep the successes and ignore the failures.
    let kept: Vec<i32> = ["1", "x", "3"].iter().filter_map(|s| s.parse().ok()).collect();
    println!("kept {kept:?}");

    // Partitioning successes from failures.
    let (oks, errs): (Vec<_>, Vec<_>) = ["4", "y", "6"]
        .iter()
        .map(|s| s.parse::<i32>())
        .partition(|r| r.is_ok());
    println!("{} ok, {} failed", oks.len(), errs.len());

    // Panics are for bugs. This one is caught so the demo can continue.
    let outcome = std::panic::catch_unwind(|| {
        let v: Vec<i32> = vec![];
        v[0] // index out of bounds
    });
    println!("caught a panic? {}", outcome.is_err());

    // assert! family: panics that document invariants.
    assert_eq!(2 + 2, 4, "arithmetic is broken");
    println!("assertions held");
}

fn checked_half(n: i32) -> Result<i32, String> {
    if n % 2 == 0 {
        Ok(n / 2)
    } else {
        Err(format!("{n} is odd"))
    }
}

fn divide_text(numerator: i32, denominator: &str) -> Result<i32, String> {
    let d: i32 = denominator
        .parse()
        .map_err(|_| format!("{denominator:?} is not a number"))?;
    if d == 0 {
        return Err("cannot divide by zero".to_string());
    }
    Ok(numerator / d)
}`,
      exercise: {
        prompt:
          "Write `fn parse_pair(s: &str) -> Result<(i32, i32), String>` that splits on a comma and parses both halves, mapping any parse failure to a `String`. Print the result for `\"3,4\"` so the output contains `Ok((3, 4))`.",
        expect: { contains: ["Ok((3, 4))"] },
        hint: "Use `split_once(',')`, `ok_or(\"no comma\".to_string())?`, then `.trim().parse().map_err(|e| format!(\"{e}\"))?` on each half.",
      },
    },

    {
      slug: "question-mark",
      title: "The ? operator",
      summary:
        "Propagating errors in one character, and the `From` conversion that makes it work across error types.",
      tags: ["?", "From", "propagation", "Box<dyn Error>"],
      body: md(
        "Writing `match` around every fallible call buries the logic. `?` is the shorthand:",
        "",
        "```rust",
        "let n: i32 = text.parse()?;",
        "```",
        "",
        "which means: if `Ok(v)`, evaluate to `v` and carry on; if `Err(e)`, **return** `Err(e.into())` from the enclosing function immediately.",
        "",
        "Two consequences follow from that definition.",
        "",
        "## It only works in a function that returns Result (or Option)",
        "",
        "`?` returns from the function, so the signature has to be able to express failure. In `main`, that means `fn main() -> Result<(), Box<dyn Error>>` — which is allowed, and prints the `Debug` form of the error and exits non-zero if one escapes.",
        "",
        "## The error type converts automatically",
        "",
        "That `.into()` is the clever part. `?` applies `From` to the error, so a function returning `Box<dyn Error>` can `?` on a `ParseIntError`, an `io::Error` and your own error type in the same body — each converts on the way out.",
        "",
        "This is why implementing `From<OtherError> for MyError` is such a common pattern: it makes `?` work seamlessly across layers. The next lesson builds exactly that.",
        "",
        "## On Option",
        "",
        "`?` works on `Option` too, returning `None` early, in a function returning `Option`. You cannot mix the two in one function — use `.ok_or(...)` to cross over from `Option` to `Result`.",
        "",
        "> `Box<dyn Error>` is the pragmatic choice for application code and prototypes: it accepts anything error-shaped. Libraries usually want a concrete error enum so callers can match on the cases.",
      ),
      code: `use std::error::Error;
use std::fmt;

fn main() -> Result<(), Box<dyn Error>> {
    // Each of these propagates with ?, and each has a different error type.
    println!("sum of \\"1 2 3\\" = {}", sum_list("1 2 3")?);
    println!("config port = {}", read_port("port=8080")?);

    // Failures are returned as values, so they can be inspected.
    match sum_list("1 oops 3") {
        Ok(n) => println!("unexpected success {n}"),
        Err(e) => println!("as expected, failed: {e}"),
    }

    match read_port("prt=99") {
        Ok(n) => println!("unexpected success {n}"),
        Err(e) => println!("as expected, failed: {e}"),
    }

    // ? on Option, in a function returning Option.
    println!("domain of a@b.com: {:?}", domain_of("a@b.com"));
    println!("domain of nonsense: {:?}", domain_of("nonsense"));

    // A chain where several different error types flow through one ?.
    for raw in ["12", "x", "-5"] {
        match pipeline(raw) {
            Ok(v) => println!("{raw:?} -> {v}"),
            Err(e) => println!("{raw:?} -> error: {e}"),
        }
    }

    Ok(())
}

/// ? on a ParseIntError, converted into Box<dyn Error> on the way out.
fn sum_list(s: &str) -> Result<i32, Box<dyn Error>> {
    let mut total = 0;
    for token in s.split_whitespace() {
        total += token.parse::<i32>()?;
    }
    Ok(total)
}

/// A custom error type, so ? can convert into it via From.
#[derive(Debug)]
enum ConfigError {
    MissingKey(String),
    NotANumber(String),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ConfigError::MissingKey(k) => write!(f, "missing key {k:?}"),
            ConfigError::NotANumber(v) => write!(f, "{v:?} is not a number"),
        }
    }
}

impl Error for ConfigError {}

/// This impl is what lets ? turn a ParseIntError into a ConfigError.
impl From<std::num::ParseIntError> for ConfigError {
    fn from(e: std::num::ParseIntError) -> Self {
        ConfigError::NotANumber(e.to_string())
    }
}

fn read_port(line: &str) -> Result<u16, ConfigError> {
    let (key, value) = line
        .split_once('=')
        .ok_or_else(|| ConfigError::MissingKey("=".to_string()))?;
    if key != "port" {
        return Err(ConfigError::MissingKey("port".to_string()));
    }
    let port: u16 = value.parse()?; // From<ParseIntError> does the conversion
    Ok(port)
}

/// ? on Option returns None early.
fn domain_of(email: &str) -> Option<&str> {
    let at = email.find('@')?;
    let rest = email.get(at + 1..)?;
    if rest.contains('.') {
        Some(rest)
    } else {
        None
    }
}

/// Several error sources, one return type.
fn pipeline(raw: &str) -> Result<i32, Box<dyn Error>> {
    let n: i32 = raw.trim().parse()?;
    let positive = u32::try_from(n)?; // TryFromIntError
    Ok((positive * 2) as i32)
}`,
      exercise: {
        prompt:
          "Write `fn first_number(s: &str) -> Result<i32, Box<dyn std::error::Error>>` that takes the first whitespace-separated token and parses it using `?` twice (once via `ok_or`). Call it with `\"7 8 9\"` and print `first: 7`.",
        expect: { contains: ["first: 7"], sourceContains: ["?"] },
        hint: "`let tok = s.split_whitespace().next().ok_or(\"empty\")?; let n: i32 = tok.parse()?; Ok(n)`",
      },
    },

    {
      slug: "custom-errors",
      title: "Designing your own error type",
      summary:
        "An error enum that implements Display and Error, wraps causes, and plays nicely with `?`.",
      tags: ["Error", "Display", "From", "source"],
      body: md(
        "A good error type in Rust is usually an enum with one variant per thing that can go wrong, plus three impls:",
        "",
        "1. `Debug` — derive it. `?` in `main` and `unwrap` both print this form.",
        "2. `Display` — write it by hand. This is the message a user sees, so it should be a lowercase sentence fragment with no trailing full stop, by convention.",
        "3. `std::error::Error` — the marker that makes your type usable as `Box<dyn Error>`. Override `source()` to expose an underlying cause so callers can walk the chain.",
        "",
        "Then add `From` impls for each foreign error you want `?` to absorb.",
        "",
        "## Why an enum rather than a string",
        "",
        "Because callers can `match` on it. `Err(\"not found\".to_string())` forces every caller to do string comparison; `Err(StoreError::NotFound { id })` lets them handle the not-found case specifically and gives them the id.",
        "",
        "## In real projects",
        "",
        "Two crates dominate, and both are worth knowing about:",
        "",
        "- **thiserror** derives all of the above from attributes. For libraries.",
        "- **anyhow** gives you one opaque `anyhow::Error` with context chaining (`.context(\"while loading config\")`). For applications, where the caller is a human reading a log.",
        "",
        "The hand-written version below is what `thiserror` generates for you — worth doing once so the macro holds no mysteries.",
      ),
      code: `use std::error::Error;
use std::fmt;

/// One variant per failure mode, carrying whatever the caller needs.
#[derive(Debug)]
enum OrderError {
    EmptyCart,
    ItemNotFound { sku: String },
    InsufficientStock { sku: String, wanted: u32, available: u32 },
    BadQuantity(std::num::ParseIntError),
}

impl fmt::Display for OrderError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            OrderError::EmptyCart => write!(f, "the cart is empty"),
            OrderError::ItemNotFound { sku } => write!(f, "no such item: {sku}"),
            OrderError::InsufficientStock { sku, wanted, available } => write!(
                f,
                "only {available} of {sku} left, but {wanted} requested"
            ),
            OrderError::BadQuantity(e) => write!(f, "quantity is not a number: {e}"),
        }
    }
}

impl Error for OrderError {
    /// Exposing the cause lets callers walk the chain.
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            OrderError::BadQuantity(e) => Some(e),
            _ => None,
        }
    }
}

/// This is what makes ? work on a parse() inside place_order.
impl From<std::num::ParseIntError> for OrderError {
    fn from(e: std::num::ParseIntError) -> Self {
        OrderError::BadQuantity(e)
    }
}

struct Inventory {
    items: Vec<(String, u32)>,
}

impl Inventory {
    fn stock_of(&self, sku: &str) -> Option<u32> {
        self.items.iter().find(|(s, _)| s == sku).map(|(_, n)| *n)
    }
}

fn place_order(inv: &Inventory, sku: &str, qty_text: &str) -> Result<u32, OrderError> {
    if sku.is_empty() {
        return Err(OrderError::EmptyCart);
    }
    let wanted: u32 = qty_text.parse()?; // converted by the From impl above
    let available = inv
        .stock_of(sku)
        .ok_or_else(|| OrderError::ItemNotFound { sku: sku.to_string() })?;
    if wanted > available {
        return Err(OrderError::InsufficientStock {
            sku: sku.to_string(),
            wanted,
            available,
        });
    }
    Ok(available - wanted)
}

fn main() {
    let inv = Inventory {
        items: vec![("widget".to_string(), 5), ("gizmo".to_string(), 0)],
    };

    let attempts = [
        ("widget", "2"),
        ("widget", "99"),
        ("sprocket", "1"),
        ("widget", "many"),
        ("", "1"),
    ];

    for (sku, qty) in attempts {
        match place_order(&inv, sku, qty) {
            Ok(left) => println!("ordered {qty} x {sku}, {left} left"),
            Err(e) => {
                println!("rejected: {e}");
                // Walk the cause chain, if any.
                let mut cause = e.source();
                while let Some(c) = cause {
                    println!("    caused by: {c}");
                    cause = c.source();
                }
                // And callers can still match on the specific case.
                if let OrderError::InsufficientStock { available, .. } = &e {
                    println!("    suggestion: order {available} instead");
                }
            }
        }
    }

    // A custom error works as Box<dyn Error> too.
    let boxed: Box<dyn Error> = Box::new(OrderError::EmptyCart);
    println!("as a boxed error: {boxed}");
}`,
      exercise: {
        prompt:
          "Define `enum MyError { TooSmall(i32) }`, implement `Display` for it so it prints `value 3 is too small`, and print that message for `MyError::TooSmall(3)`.",
        expect: { contains: ["value 3 is too small"] },
        hint: "`impl fmt::Display for MyError { fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { match self { MyError::TooSmall(n) => write!(f, \"value {n} is too small\") } } }`",
      },
    },
  ],
};
