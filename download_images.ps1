# Create the img directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "public/img"

# Define the image mappings (name to URL)
$images = @{
    "Character_Soldier.webp" = "https://static.poly.pizza/1083c1d3-d1d4-4682-adf6-bc516d06ac84.webp"
    "Character_Hazmat.webp" = "https://static.poly.pizza/484450a4-b76c-4e76-95d2-352337bb41e8.webp"
    "Character_Enemy.webp" = "https://static.poly.pizza/6d2fe602-2adf-43d2-aa20-00e68165497d.webp"
    "Water_Tank.webp" = "https://static.poly.pizza/90ce7828-ec94-4b41-9e44-e524af7aafa5.webp"
    "Cardboard_Boxes.webp" = "https://static.poly.pizza/bc840809-78e7-4111-bd38-73151ee20c4a.webp"
    "Container_Small.webp" = "https://static.poly.pizza/2e1f581e-5f9d-42ff-9ef9-600b1cfde0a6.webp"
    "Debris_Papers.webp" = "https://static.poly.pizza/ee9a1739-287c-45d2-a8d9-4f43ad82631d.webp"
    "Sign.webp" = "https://static.poly.pizza/c8fdcd5a-875a-4196-841c-df2cd6ebdc52.webp"
    "Water_Tank_Floor.webp" = "https://static.poly.pizza/1a91cb12-6531-4ac8-a8b1-2618cd9c4d7b.webp"
    "Tank.webp" = "https://static.poly.pizza/2568b2cb-58e0-49d8-9d3b-6f208ad281c7.webp"
    "Metal_Fence.webp" = "https://static.poly.pizza/94d06743-b682-4a86-9bba-499c351282b7.webp"
    "Tree.webp" = "https://static.poly.pizza/6293cb05-07cc-4f3f-858c-06b3f720c60b.webp"
    "Sniper.webp" = "https://static.poly.pizza/12d63675-0406-4fe5-b108-30ef53c85625.webp"
    "Revolver_Small.webp" = "https://static.poly.pizza/84a02740-979b-4113-bd7d-196bcb3d354d.webp"
    "Short_Cannon.webp" = "https://static.poly.pizza/596cd912-c25a-41e2-b2b9-cca14c06c9b3.webp"
}

# Download each image
foreach ($imageName in $images.Keys) {
    $url = $images[$imageName]
    $outputPath = "public/img/$imageName"
    
    Write-Host "Downloading $imageName from $url"
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath
        Write-Host "Successfully downloaded $imageName" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download $imageName: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "All downloads complete!" -ForegroundColor Cyan 