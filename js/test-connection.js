async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase connection FAILED:", error);
    alert("Connection failed. Check console.");
  } else {
    console.log("Supabase connection SUCCESS:", data);
    alert("Supabase connected successfully!");
  }
}

testSupabaseConnection();
