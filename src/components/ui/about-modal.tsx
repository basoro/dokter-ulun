import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tentang ICT RSHD Barabai</DialogTitle>
          <DialogDescription>
            <div className="py-4">
              <p>Ditetapkan sebagai Instalasi ICT dengan Surat Keputusan Direktur Rumah Sakit Umum Daerah H. Damanhuri pada tanggal 1 November 2017.</p>
              {/* <p className="mt-2">Jl. Murakata 04, Barabai, Kabupaten Hulu Sungai Tengah</p> */}
              <p className="text-md mt-2">
                Kepala Instalasi :
              </p>
              <p className="text-md mb-2">MasBas (drg. Faisol Basoro)</p>
              <p className="text-md">Anggota :</p>
              <ul>
                <li>Amat (Muhammad Ma'ruf, S.Kom)</li>
                <li>Aruf (Ma'ruf, S.Kom)</li>
                <li>Didi (Didi Andriawan, S.Kom)</li>
                <li>Adly (M. Adly Hidayat, S.Kom)</li>
                <li>Ridho (M. Alfian Ridho, S.Kom) (Alm)</li>
                <li>Ijai (Zailani)</li>
                <li>Ina (Inarotut Darojah) (2019 left)</li>
                <li>Iqbal (Muhammad Iqbal Arisyi, S.Kom)</li> 
                <li>Iki (Muhammad Rizki Renaldi)</li>
                <li>Nora (Nora Gusti Salsabila, S.Kom)</li>
                <li>Reza (Muhammad Reza, S.Kom)</li>
                <li>Rakha (Rakha Fauziannur, S.Kom)</li>
                <li>Mukhdi (Muhammad Mukhdi, S.Kom)</li>
                <li>Pebrie (Muhammad Pebrie Budiman, S.Kom)</li>
                <li>Ana (Erliana, A.Md.Kom)</li> 
                <li>Wanda (Wanda Septia Dewi Lestari, S.Kom)</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">Version 2.0.0</p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}