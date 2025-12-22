alert("test-connection.js is executing");

async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase connection FAILED:", error);
    alert("Supabase failed. Check console.");
  } else {
    console.log("Supabase connection SUCCESS:", data);
    alert("Supabase connected successfully!");
  }
}

testSupabaseConnection();
