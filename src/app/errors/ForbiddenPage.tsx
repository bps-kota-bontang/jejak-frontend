import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ForbiddenPage = () => {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center p-4 md:p-6">
      <Card className="w-full border-rose-200 bg-rose-50">
        <CardHeader>
          <CardTitle>Akses Ditolak</CardTitle>
          <CardDescription>Anda tidak memiliki hak akses ke halaman ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/surveys">Kembali ke Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

export default ForbiddenPage;