//! Perfil reprodutível das operações de I/O e PDF usadas no hardening.

use lopdf::{Document as PdfDocument, Object, dictionary};
use nexohub_core::ProjectStore;
use nexohub_core::pdf_tools::{CompressPdfRequest, compress_pdf};
use std::error::Error;
use std::fs::{self, File};
use std::path::PathBuf;
use std::time::Instant;
use uuid::Uuid;

struct ProfileRoot(PathBuf);

impl ProfileRoot {
    fn new() -> Result<Self, Box<dyn Error>> {
        let path = std::env::temp_dir().join(format!("nexohub-profile-{}", Uuid::new_v4()));
        fs::create_dir(&path)?;
        Ok(Self(path))
    }
}

impl Drop for ProfileRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    println!("operation,input,elapsed_ms");
    for size_mib in [10_u64, 100, 500] {
        profile_import(size_mib)?;
    }
    profile_thousand_page_pdf()?;
    Ok(())
}

fn profile_import(size_mib: u64) -> Result<(), Box<dyn Error>> {
    let root = ProfileRoot::new()?;
    let source = root.0.join(format!("input-{size_mib}.bin"));
    File::create(&source)?.set_len(size_mib * 1024 * 1024)?;
    let project_path = root.0.join("Profile.nexohub");
    let mut store = ProjectStore::create(&project_path, "Perfil")?;
    let started = Instant::now();
    let imported = store.import_document(&source, None, "application/octet-stream")?;
    std::hint::black_box(imported.artifact.hash);
    println!("import,{size_mib}MiB,{}", started.elapsed().as_millis());
    Ok(())
}

fn profile_thousand_page_pdf() -> Result<(), Box<dyn Error>> {
    let root = ProfileRoot::new()?;
    let source = root.0.join("thousand-pages.pdf");
    fs::write(&source, synthetic_pdf(1_000)?)?;
    let project_path = root.0.join("Profile.nexohub");
    let mut store = ProjectStore::create(&project_path, "Perfil PDF")?;
    let imported = store.import_document(&source, None, "application/pdf")?;
    drop(store);
    let started = Instant::now();
    let result = compress_pdf(CompressPdfRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id,
        artifact_id: imported.artifact.id,
        compression_level: 6,
    })?;
    std::hint::black_box(result.artifact.hash);
    println!("pdf-compress,1000-pages,{}", started.elapsed().as_millis());
    Ok(())
}

fn synthetic_pdf(page_count: usize) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut pdf = PdfDocument::with_version("1.5");
    let pages_id = pdf.new_object_id();
    let page_ids = (0..page_count)
        .map(|_| {
            pdf.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            })
        })
        .collect::<Vec<_>>();
    pdf.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids.into_iter().map(Into::into).collect::<Vec<Object>>(),
            "Count" => page_count as i64,
        }),
    );
    let catalog_id = pdf.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    pdf.trailer.set("Root", catalog_id);
    let mut bytes = Vec::new();
    pdf.save_to(&mut bytes)?;
    Ok(bytes)
}
