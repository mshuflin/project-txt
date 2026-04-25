use regex::Regex;
fn main() {
    let ctx_re = Regex::new(r"(?:^|\s)@(\S+)").unwrap();
    let proj_re = Regex::new(r"(?:^|\s)\+(\S+)").unwrap();
    let text = "user@gmail.com @realcontext +realproject word+falseproject";
    println!("Contexts:");
    for cap in ctx_re.captures_iter(text) {
        println!("Match: {}", &cap[1]);
    }
    println!("Projects:");
    for cap in proj_re.captures_iter(text) {
        println!("Match: {}", &cap[1]);
    }
}
