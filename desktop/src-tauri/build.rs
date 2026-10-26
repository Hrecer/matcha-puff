fn main() {
    // frontendDist 的产物由 generate_context! 在编译期嵌入 exe；
    // 不声明依赖时，rebuild 前端后 cargo 会判定 crate 未变而跳过编译，

    println!("cargo:rerun-if-changed=../frontend");
    tauri_build::build()
}
