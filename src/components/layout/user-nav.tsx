'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

export function UserNav() {
  const { state } = useSidebar();
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

  if (state === 'collapsed') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10 bg-sidebar-accent/20">
              <AvatarFallback className="bg-transparent text-sidebar-foreground font-bold">AD</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">實驗室主管</p>
              <p className="text-xs leading-none text-muted-foreground">
                管理員
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>個人資料</DropdownMenuItem>
            <DropdownMenuItem>設定</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>登出</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/10">
      <Avatar className="h-10 w-10 bg-sidebar-accent/20">
         <AvatarFallback className="bg-transparent text-sidebar-foreground font-bold">AD</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-sidebar-foreground">實驗室主管</span>
        <span className="text-xs text-sidebar-foreground/80">管理員</span>
      </div>
    </div>
  );
}
