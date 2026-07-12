import { useState } from "react"
import {
  IconBell as BellIcon,
  IconBold as BoldIcon,
  IconCalendar as CalendarIcon,
  IconChartAreaLine as AreaChart,
  IconChartLine as LineChart,
  IconCopy as CopyIcon,
  IconDots as MoreHorizontalIcon,
  IconFileText as FileTextIcon,
  IconItalic as ItalicIcon,
  IconMail as MailIcon,
  IconPlus as PlusIcon,
  IconSearch as SearchIcon,
  IconShare2 as Share2Icon,
  IconSparkles as SparklesIcon,
  IconTrash as TrashIcon,
} from "@tabler/icons-react"
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis } from "recharts"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "@/components/ui/menubar"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const chartData = [
  { month: "Feb", views: 90 },
  { month: "Mar", views: 132 },
  { month: "Apr", views: 168 },
  { month: "May", views: 241 },
  { month: "Jun", views: 318 },
]

const chartConfig = {
  views: {
    label: "Views",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const ownerGroups = [
  {
    value: "Team",
    items: ["Maya Patel", "Rina Cohen", "Ben Segarra"],
  },
]

export function PrimitiveGallery() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 14))

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GalleryCard title="Navigation" description="Breadcrumbs, menus, tabs, pagination, and popovers.">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/sites">Sites</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Acme rollout brief</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Site</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Duplicate</MenubarItem>
              <MenubarItem>Publish</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Archive</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Builder</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-72 gap-2 p-3">
                  <NavigationMenuLink className="rounded-md p-2 hover:bg-accent" href="/edit/demo-site">
                    Editor
                  </NavigationMenuLink>
                  <NavigationMenuLink className="rounded-md p-2 hover:bg-accent" href="/design-system">
                    Design system
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="variants">Variants</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Use tabs for compact page-level modes.</TabsContent>
          <TabsContent value="variants">Variants track recipient-specific links.</TabsContent>
        </Tabs>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </GalleryCard>

      <GalleryCard title="Actions" description="Buttons, groups, dropdowns, dialogs, sheets, drawers, and alerts.">
        <div className="flex flex-wrap gap-2">
          <Button>
            <PlusIcon data-icon="inline-start" />
            Create
          </Button>
          <Button variant="outline">
            <Share2Icon data-icon="inline-start" />
            Share
          </Button>
          <Button variant="secondary">Draft</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontalIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
        </div>
        <ButtonGroup>
          <Button variant="outline">
            <BoldIcon data-icon="inline-start" />
            Bold
          </Button>
          <ButtonGroupSeparator />
          <Button variant="outline">
            <ItalicIcon data-icon="inline-start" />
            Italic
          </Button>
          <ButtonGroupText>
            <Kbd>⌘B</Kbd>
          </ButtonGroupText>
        </ButtonGroup>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Dropdown</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Site actions</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2Icon />
                  Share
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <TrashIcon />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create site</DialogTitle>
                <DialogDescription>Name the one-pager before opening the editor.</DialogDescription>
              </DialogHeader>
              <Input placeholder="Acme rollout brief" />
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
                <SheetDescription>Configure selected block options.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Publish site</DrawerTitle>
                <DrawerDescription>Review the public link before sharing.</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button>Publish</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Confirm</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unpublish this site?</AlertDialogTitle>
                <AlertDialogDescription>
                  Visitors will no longer be able to access the current link.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Unpublish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Alert>
          <SparklesIcon />
          <AlertTitle>Share-ready</AlertTitle>
          <AlertDescription>Use alerts for clear operational feedback.</AlertDescription>
        </Alert>
      </GalleryCard>

      <GalleryCard title="Forms" description="Fields, grouped inputs, selects, toggles, OTP, slider, and validation state.">
        <FieldSet>
          <FieldLegend>Site details</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="primitive-title">Title</FieldLabel>
              <Input id="primitive-title" defaultValue="Acme rollout brief" />
              <FieldDescription>Displayed as the public page headline.</FieldDescription>
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor="primitive-slug">Slug</FieldLabel>
              <Input id="primitive-slug" aria-invalid defaultValue="acme-rollout" />
              <FieldError>This slug is already in use.</FieldError>
            </Field>
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <Combobox items={ownerGroups}>
                <ComboboxInput placeholder="Search teammates" />
                <ComboboxContent>
                  <ComboboxEmpty>No teammate found.</ComboboxEmpty>
                  <ComboboxList>
                    {(group) => (
                      <ComboboxGroup key={group.value} items={group.items}>
                        <ComboboxLabel>{group.value}</ComboboxLabel>
                        <ComboboxCollection>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxGroup>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select defaultValue="draft">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Status</SelectLabel>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Native select</FieldLabel>
                <NativeSelect defaultValue="team">
                  <NativeSelectOption value="private">Private</NativeSelectOption>
                  <NativeSelectOption value="team">Team</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel>Share link</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>lightsite.app/acme/</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput defaultValue="rollout-brief" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="Copy share link">
                    <CopyIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel>Access code</FieldLabel>
              <InputOTP maxLength={6}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </Field>
            <Field>
              <FieldLabel htmlFor="primitive-notes">Notes</FieldLabel>
              <Textarea id="primitive-notes" defaultValue="Keep the one-pager specific to the prospect request." />
            </Field>
            <Field orientation="horizontal">
              <Switch id="primitive-toc" defaultChecked />
              <FieldContent>
                <FieldTitle>Show table of contents</FieldTitle>
                <FieldDescription>Useful for longer follow-up pages.</FieldDescription>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Variant depth</FieldLabel>
              <Slider value={[60]} max={100} step={10} />
            </Field>
            <Field>
              <FieldLabel>Contact method</FieldLabel>
              <RadioGroup defaultValue="email" className="flex gap-4">
                <Field orientation="horizontal">
                  <RadioGroupItem id="radio-email" value="email" />
                  <FieldLabel htmlFor="radio-email">Email</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="radio-call" value="call" />
                  <FieldLabel htmlFor="radio-call">Call</FieldLabel>
                </Field>
              </RadioGroup>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="primitive-copy" defaultChecked />
              <FieldLabel htmlFor="primitive-copy">Allow view and copy</FieldLabel>
            </Field>
          </FieldGroup>
        </FieldSet>
      </GalleryCard>

      <GalleryCard title="Data" description="Cards, tables, charts, scroll areas, resizable panels, progress, and loading states.">
        <div className="grid gap-3 md:grid-cols-3">
          {["Drafts", "Views", "Variants"].map((label, index) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle>{[6, 418, 37][index]}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="h-48">
          <RechartsLineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={2} dot={false} />
          </RechartsLineChart>
        </ChartContainer>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {["Acme", "Northstar", "Q3 expansion"].map((name, index) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{index === 1 ? "Draft" : "Published"}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{[84, 0, 191][index]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ResizablePanelGroup orientation="horizontal" className="min-h-32 rounded-lg border">
          <ResizablePanel defaultSize={55} className="p-3">
            <ScrollArea className="h-24">
              <div className="flex flex-col gap-2 pr-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="rounded-md border p-2 text-sm">
                    Activity row {index + 1}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={45} className="p-3">
            <div className="flex flex-col gap-3">
              <Progress value={68} />
              <Skeleton className="h-8 w-full" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Syncing analytics
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </GalleryCard>

      <GalleryCard title="Content" description="Accordion, collapsible, command, context menu, empty, hover card, items, carousel, and calendar.">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="one">
            <AccordionTrigger>What is a Lightsite?</AccordionTrigger>
            <AccordionContent>A prospect-ready one-pager with share links and tracking.</AccordionContent>
          </AccordionItem>
        </Accordion>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline">Toggle publishing checklist</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-md border p-3 text-sm">
            Confirm title, owner, variant link, and primary CTA.
          </CollapsibleContent>
        </Collapsible>
        <Command className="rounded-lg border">
          <CommandInput placeholder="Command palette" />
          <CommandList>
            <CommandEmpty>No command found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem>
                <FileTextIcon />
                Create site
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <SearchIcon />
                Search events
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-20 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Right click for context menu
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem>
                <CopyIcon />
                Copy block
              </ContextMenuItem>
              <ContextMenuItem>
                <TrashIcon />
                Delete block
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
        <ItemGroup>
          <Item variant="outline">
            <ItemMedia variant="icon">
              <MailIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Follow-up email</ItemTitle>
              <ItemDescription>Send this one-pager after a discovery call.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary">Ready</Badge>
            </ItemActions>
          </Item>
        </ItemGroup>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AreaChart />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>Publish and share a link to begin tracking activity.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline">Copy public link</Button>
          </EmptyContent>
        </Empty>
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link" className="w-fit px-0">
              Hover for variant details
            </Button>
          </HoverCardTrigger>
          <HoverCardContent>
            A variant can personalize text and track opens for a single prospect.
          </HoverCardContent>
        </HoverCard>
        <div className="grid gap-4 md:grid-cols-2">
          <Calendar mode="single" selected={date} onSelect={setDate} />
          <Carousel className="mx-auto w-full max-w-xs">
            <CarouselContent>
              {[1, 2, 3].map((item) => (
                <CarouselItem key={item}>
                  <AspectRatio ratio={16 / 9} className="rounded-lg border bg-muted">
                    <div className="flex size-full items-center justify-center text-sm">
                      Slide {item}
                    </div>
                  </AspectRatio>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </GalleryCard>

      <GalleryCard title="Selection and feedback" description="Badges, avatars, labels, popovers, toggles, separators, sonner, and switches.">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar>
            <AvatarFallback>LS</AvatarFallback>
          </Avatar>
          <Badge>Published</Badge>
          <Badge variant="secondary">Private</Badge>
          <Badge variant="outline">Variant</Badge>
          <Label htmlFor="notify">Notifications</Label>
          <Switch id="notify" defaultChecked />
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Toggle aria-label="Toggle bold">
            <BoldIcon />
          </Toggle>
          <ToggleGroup type="single" defaultValue="line">
            <ToggleGroupItem value="line" aria-label="Line style">
              <LineChart />
            </ToggleGroupItem>
            <ToggleGroupItem value="card" aria-label="Card style">
              <FileTextIcon />
            </ToggleGroupItem>
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon data-icon="inline-start" />
                Open popover
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              Popovers are useful for inline publish and share controls.
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={() => toast.success("Design system toast", { description: "Sonner is wired." })}
          >
            <BellIcon data-icon="inline-start" />
            Toast
          </Button>
        </div>
      </GalleryCard>
    </div>
  )
}

function GalleryCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      <CardFooter className="text-xs text-muted-foreground">Built from installed shadcn primitives.</CardFooter>
    </Card>
  )
}
